import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Pressable, Alert } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useCurrentLocation } from '@/hooks/useLocation';
import { fetchNearbyStores } from '@/api/stores';
import { fetchNearbyShelters } from '@/api/shelters';
import { fetchShadyWalkingRoute, fetchTransitRoutes, reclassifyShade, fetchShadeForecast, ShadeForecastEntry } from '@/api/directions';
import { fetchCurrentWeather } from '@/api/weather';
import { CurrentWeather } from '@/types/weather';
import { ConvenienceStore } from '@/types/store';
import { Shelter } from '@/types/shelter';
import { ShadyRoute } from '@/types/shadyRoute';
import { TransitItinerary } from '@/types/transit';
import { RootTabParamList } from '@/navigation/RootNavigator';
import { distanceMeters } from '@/utils/geo';
import { Colors } from '@/theme/colors';
import MarkerBadge from '@/components/MarkerBadge';
import StoreDetailModal from '@/components/StoreDetailModal';
import ShelterDetailModal from '@/components/ShelterDetailModal';

type MapRoute = RouteProp<RootTabParamList, 'Map'>;

type FilterKey = 'CONVENIENCE_STORE' | 'HEAT_SHELTER';

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'CONVENIENCE_STORE', label: '편의점', icon: '🏪' },
  { key: 'HEAT_SHELTER', label: '무더위쉼터', icon: '🌡️' },
];

// 그늘(브랜드 컬러=안전) / 노출(경고 컬러=위험)로 의미를 일관되게 표현
const SHADE_COLOR = Colors.primary;
const EXPOSED_COLOR = Colors.danger;
const TRANSIT_WALK_COLOR = Colors.neutral;

function segmentColor(source: 'building' | 'none'): string {
  return source === 'building' ? SHADE_COLOR : EXPOSED_COLOR;
}

function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 1) return '1분 미만';
  return `${min}분`;
}

function legIcon(mode: string): string {
  if (mode === 'WALK') return '🚶';
  if (mode === 'BUS') return '🚌';
  if (mode === 'SUBWAY') return '🚇';
  return '➡️';
}

function legLabel(leg: TransitItinerary['legs'][number]): string {
  if (leg.mode === 'WALK') {
    return `도보 ${formatDuration(leg.sectionTime)}`;
  }
  const name = leg.routeName ?? leg.mode;
  return `${name} · ${formatDuration(leg.sectionTime)}`;
}

export default function MapScreen() {
  const mapScreenRoute = useRoute<MapRoute>();
  const { location, errorMsg, loading: locLoading, refresh } = useCurrentLocation();
  const mapRef = useRef<MapView>(null);
  const [stores, setStores] = useState<ConvenienceStore[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    new Set(['CONVENIENCE_STORE', 'HEAT_SHELTER'])
  );

  const [selectedStore, setSelectedStore] = useState<ConvenienceStore | null>(null);
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [shelterModalVisible, setShelterModalVisible] = useState(false);

  // 도보(그늘 포함) 경로 상태
  const [route, setRoute] = useState<ShadyRoute | null>(null);
  const [routeVersion, setRouteVersion] = useState(0);
  const [shadeForecast, setShadeForecast] = useState<ShadeForecastEntry[] | null>(null);
  const [selectedOffsetMinutes, setSelectedOffsetMinutes] = useState(0);

  // 대중교통 경로 상태
  const [transitItineraries, setTransitItineraries] = useState<TransitItinerary[] | null>(null);
  const [selectedTransitIndex, setSelectedTransitIndex] = useState(0);
  const [transitVersion, setTransitVersion] = useState(0);

  const [travelMode, setTravelMode] = useState<'WALK' | 'TRANSIT' | null>(null);
  const [routeTargetName, setRouteTargetName] = useState<string>('');
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoadingData(true);
    Promise.all([
      fetchNearbyStores(location.latitude, location.longitude, 1000),
      fetchNearbyShelters(location.latitude, location.longitude, 1500, '무더위쉼터'),
    ])
      .then(([storeData, shelterData]) => {
        setStores(storeData);
        setShelters(shelterData);
      })
      .catch((e) => console.warn('데이터 조회 실패', e))
      .finally(() => setLoadingData(false));

    fetchCurrentWeather(location.latitude, location.longitude)
      .then(setWeather)
      .catch((e) => console.warn('날씨 조회 실패', e));
  }, [location]);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleStorePress = (store: ConvenienceStore) => {
    setSelectedStore(store);
    setStoreModalVisible(true);
  };

  const handleShelterPress = (shelter: Shelter) => {
    setSelectedShelter(shelter);
    setShelterModalVisible(true);
  };

  const findNearestTarget = (): { lat: number; lng: number; name: string } | null => {
    const candidates: { lat: number; lng: number; name: string; distance: number }[] = [];
    if (activeFilters.has('CONVENIENCE_STORE')) {
      stores.forEach((s) =>
        candidates.push({ lat: s.lat, lng: s.lng, name: s.name, distance: s.distance ?? Infinity })
      );
    }
    if (activeFilters.has('HEAT_SHELTER')) {
      shelters.forEach((s) =>
        candidates.push({ lat: s.lat, lng: s.lng, name: s.name, distance: s.distance ?? Infinity })
      );
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0];
  };

  const routeTargetRef = useRef<{ lat: number; lng: number; name: string } | null>(null);
  const lastRouteOriginRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const clearRoute = () => {
    setRoute(null);
    setShadeForecast(null);
    setSelectedOffsetMinutes(0);
    setTransitItineraries(null);
    setSelectedTransitIndex(0);
    setTravelMode(null);
    setRouteTargetName('');
    routeTargetRef.current = null;
    lastRouteOriginRef.current = null;
  };

  const requestWalkingRoute = async (
    origin: { latitude: number; longitude: number },
    target: { lat: number; lng: number; name: string },
    options: { fitMap?: boolean } = {}
  ): Promise<boolean> => {
    try {
      const result = await fetchShadyWalkingRoute(
        origin,
        { latitude: target.lat, longitude: target.lng },
        target.name
      );
      setRoute(result);
      setRouteVersion((v) => v + 1);
      setTransitItineraries(null);
      setTravelMode('WALK');
      setRouteTargetName(target.name);
      routeTargetRef.current = target;
      lastRouteOriginRef.current = origin;
      if (options.fitMap && result.path.length > 0) {
        mapRef.current?.fitToCoordinates(result.path, {
          edgePadding: { top: 100, right: 60, bottom: 260, left: 60 },
          animated: true,
        });
        // 최초 안내 시작할 때만 시간대별 그늘 비교도 같이 조회 (실시간 갱신 때는 스킵)
        setSelectedOffsetMinutes(0);
        fetchShadeForecast(
          origin,
          result.segments.map((s) => ({ coordinates: s.coordinates, distance: s.distance, time: s.time }))
        )
          .then(setShadeForecast)
          .catch((e) => console.warn('그늘 시간대 예측 실패', e));
      }
      return true;
    } catch (e) {
      console.warn('경로 조회 실패', e);
      return false;
    }
  };

  const requestTransitRoute = async (
    origin: { latitude: number; longitude: number },
    target: { lat: number; lng: number; name: string },
    options: { fitMap?: boolean } = {}
  ): Promise<boolean> => {
    try {
      const itineraries = await fetchTransitRoutes(
        origin,
        { latitude: target.lat, longitude: target.lng },
        2
      );
      if (itineraries.length === 0) {
        Alert.alert('알림', '이 구간은 대중교통 경로를 찾지 못했어요.');
        return false;
      }
      setTransitItineraries(itineraries);
      setSelectedTransitIndex(0);
      setTransitVersion((v) => v + 1);
      setRoute(null);
      setTravelMode('TRANSIT');
      setRouteTargetName(target.name);
      routeTargetRef.current = target;
      lastRouteOriginRef.current = origin;

      if (options.fitMap) {
        const allCoords = itineraries[0].legs.flatMap((leg) => leg.path);
        if (allCoords.length > 0) {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 100, right: 60, bottom: 280, left: 60 },
            animated: true,
          });
        }
      }
      return true;
    } catch (e) {
      console.warn('대중교통 경로 조회 실패', e);
      return false;
    }
  };

  const chooseModeAndGuide = (target: { lat: number; lng: number; name: string }) => {
    if (!location) return;
    Alert.alert('경로 안내', `${target.name}까지 어떻게 이동할까요?`, [
      {
        text: '🚶 도보',
        onPress: async () => {
          setRouteLoading(true);
          const ok = await requestWalkingRoute(location, target, { fitMap: true });
          if (!ok) Alert.alert('오류', '경로를 불러오지 못했습니다.');
          setRouteLoading(false);
        },
      },
      {
        text: '🚌 대중교통',
        onPress: async () => {
          setRouteLoading(true);
          const ok = await requestTransitRoute(location, target, { fitMap: true });
          if (!ok) Alert.alert('오류', '경로를 불러오지 못했습니다.');
          setRouteLoading(false);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handleGuideToNearest = () => {
    const target = findNearestTarget();
    if (!target) {
      Alert.alert('알림', '표시된 장소가 없어요. 필터를 확인해주세요.');
      return;
    }
    chooseModeAndGuide(target);
  };

  // 경로 안내 중, 사용자가 25m 이상 이동하면 현재 위치 기준으로 다시 계산 (도보/대중교통 공통)
  useEffect(() => {
    if (!location || !routeTargetRef.current || !travelMode) return;
    const last = lastRouteOriginRef.current;
    const moved = !last || distanceMeters(last, location) > 25;
    if (!moved) return;
    if (travelMode === 'WALK') {
      requestWalkingRoute(location, routeTargetRef.current, { fitMap: false });
    } else if (travelMode === 'TRANSIT') {
      requestTransitRoute(location, routeTargetRef.current, { fitMap: false });
    }
  }, [location, travelMode]);

  const [recentering, setRecentering] = useState(false);

  const handleRecenter = async () => {
    setRecentering(true);
    try {
      const fresh = await refresh();
      if (fresh) {
        mapRef.current?.animateToRegion(
          {
            latitude: fresh.latitude,
            longitude: fresh.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      } else {
        Alert.alert('알림', '현재 위치를 가져오지 못했어요.');
      }
    } finally {
      setRecentering(false);
    }
  };

  // 검색/추천 화면에서 특정 장소를 눌러 넘어온 경우, 그 위치로 이동하고 상세정보를 띄움
  useEffect(() => {
    const { focusStore, focusShelter } = mapScreenRoute.params ?? {};
    if (!focusStore && !focusShelter) return;

    if (focusStore) {
      setSelectedStore(focusStore);
      setStoreModalVisible(true);
      mapRef.current?.animateToRegion(
        { latitude: focusStore.lat, longitude: focusStore.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    } else if (focusShelter) {
      setSelectedShelter(focusShelter);
      setShelterModalVisible(true);
      mapRef.current?.animateToRegion(
        { latitude: focusShelter.lat, longitude: focusShelter.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    }
  }, [mapScreenRoute.params]);

  if (locLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>내 위치를 확인하는 중...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  const initialRegion: Region = {
    latitude: location?.latitude ?? 37.5665,
    longitude: location?.longitude ?? 126.978,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const selectedItinerary =
    transitItineraries && transitItineraries.length > 0
      ? transitItineraries[selectedTransitIndex]
      : null;

  // 슬라이더로 선택한 시간대의 그늘 정보 (0분=지금은 실시간 갱신되는 route를 그대로 씀)
  const selectedForecast =
    selectedOffsetMinutes === 0
      ? null
      : shadeForecast?.find((f) => f.offsetMinutes === selectedOffsetMinutes) ?? null;

  const displaySegments = selectedForecast ? selectedForecast.segments : route?.segments ?? [];
  const displayShadeRatio = selectedForecast ? selectedForecast.shadeRatio : route?.shadeSummary.shadeRatio ?? 0;
  const displayMaxExposure = selectedForecast
    ? selectedForecast.maxContinuousExposureSec
    : route?.shadeSummary.maxContinuousExposureSec ?? 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
      >
        {!travelMode &&
          (activeFilters.has('CONVENIENCE_STORE') ? stores : []).map((store) => (
            <Marker
              key={`store-${store.id}`}
              coordinate={{ latitude: store.lat, longitude: store.lng }}
              title={store.name}
              description={store.roadAddress}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleStorePress(store)}
            >
              <MarkerBadge icon="🏪" color={Colors.store} />
            </Marker>
          ))}
        {!travelMode &&
          (activeFilters.has('HEAT_SHELTER') ? shelters : []).map((shelter) => (
            <Marker
              key={`shelter-${shelter.id}`}
              coordinate={{ latitude: shelter.lat, longitude: shelter.lng }}
              title={shelter.name}
              description={shelter.roadAddress || shelter.address}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleShelterPress(shelter)}
            >
              <MarkerBadge icon="🌡️" color={Colors.primary} />
            </Marker>
          ))}

        {/* 도보(그늘 정보 포함) 경로 */}
        {travelMode === 'WALK' && route && (
          <>
            <Polyline
              key={`halo-${routeVersion}`}
              coordinates={route.path}
              strokeColor="rgba(255,255,255,0.9)"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            {displaySegments.map((seg, idx) => (
              <Polyline
                key={`seg-${routeVersion}-${selectedOffsetMinutes}-${idx}`}
                coordinates={seg.coordinates}
                strokeColor={segmentColor(seg.source)}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
                zIndex={2}
              />
            ))}
            {route.path.length > 0 && (
              <Marker key={`start-${routeVersion}`} coordinate={route.path[0]} anchor={{ x: 0.5, y: 0.5 }} zIndex={3}>
                <View style={styles.routeStartDot} />
              </Marker>
            )}
            {route.path.length > 0 && (
              <Marker
                key={`end-${routeVersion}`}
                coordinate={route.path[route.path.length - 1]}
                anchor={{ x: 0.5, y: 1 }}
                zIndex={3}
              >
                <Text style={styles.routeEndFlag}>🏁</Text>
              </Marker>
            )}
          </>
        )}

        {/* 대중교통 경로: 흰 테두리 아래 깔고, 도보 구간은 얇은 회색 실선, 버스/지하철은 굵은 노선 색상 */}
        {travelMode === 'TRANSIT' &&
          selectedItinerary &&
          selectedItinerary.legs.map((leg, idx) => {
            const isWalk = leg.mode === 'WALK';
            return (
              <Polyline
                key={`transit-halo-${transitVersion}-${idx}`}
                coordinates={leg.path}
                strokeColor="rgba(255,255,255,0.9)"
                strokeWidth={isWalk ? 6 : 10}
                lineCap="round"
                lineJoin="round"
                zIndex={1}
              />
            );
          })}
        {travelMode === 'TRANSIT' &&
          selectedItinerary &&
          selectedItinerary.legs.map((leg, idx) => {
            const isWalk = leg.mode === 'WALK';
            const color = isWalk ? TRANSIT_WALK_COLOR : `#${leg.routeColor ?? '555555'}`;
            return (
              <Polyline
                key={`transit-${transitVersion}-${idx}`}
                coordinates={leg.path}
                strokeColor={color}
                strokeWidth={isWalk ? 3 : 6}
                lineCap="round"
                lineJoin="round"
                zIndex={2}
              />
            );
          })}
        {/* 환승/구간 전환 지점 표시 */}
        {travelMode === 'TRANSIT' &&
          selectedItinerary &&
          selectedItinerary.legs.slice(1).map((leg, idx) => {
            if (leg.path.length === 0) return null;
            const isWalk = leg.mode === 'WALK';
            const dotColor = isWalk ? TRANSIT_WALK_COLOR : `#${leg.routeColor ?? '555555'}`;
            return (
              <Marker
                key={`transit-transfer-${transitVersion}-${idx}`}
                coordinate={leg.path[0]}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={3}
              >
                <View style={[styles.transferDot, { borderColor: dotColor }]} />
              </Marker>
            );
          })}
        {travelMode === 'TRANSIT' && selectedItinerary && selectedItinerary.legs.length > 0 && (
          <>
            <Marker
              key={`transit-start-${transitVersion}`}
              coordinate={selectedItinerary.legs[0].path[0]}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={3}
            >
              <View style={styles.routeStartDot} />
            </Marker>
            <Marker
              key={`transit-end-${transitVersion}`}
              coordinate={
                selectedItinerary.legs[selectedItinerary.legs.length - 1].path[
                  selectedItinerary.legs[selectedItinerary.legs.length - 1].path.length - 1
                ]
              }
              anchor={{ x: 0.5, y: 1 }}
              zIndex={3}
            >
              <Text style={styles.routeEndFlag}>🏁</Text>
            </Marker>
          </>
        )}
      </MapView>

      <View style={styles.filterBar}>
        {FILTERS.map((f) => {
          const active = activeFilters.has(f.key);
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => toggleFilter(f.key)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.icon} {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {weather && weather.temperature != null && (
        <View style={styles.weatherBadge}>
          <Text style={styles.weatherBadgeText}>🌡️ {Math.round(weather.temperature)}°C</Text>
        </View>
      )}

      {loadingData && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator />
        </View>
      )}

      <Pressable style={styles.recenterButton} onPress={handleRecenter} disabled={recentering}>
        {recentering ? (
          <ActivityIndicator size="small" color="#333" />
        ) : (
          <Text style={styles.recenterButtonIcon}>📍</Text>
        )}
      </Pressable>

      {travelMode === 'WALK' && route ? (
        <View style={styles.routeSummary}>
          <View style={styles.routeSummaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeSummaryTitle}>🚶 {routeTargetName}까지</Text>
              <Text style={styles.routeSummaryDetail}>
                {route.totalDistance}m · 도보 {formatDuration(route.totalTime)}
              </Text>
            </View>
            <Pressable style={styles.routeCloseButton} onPress={clearRoute}>
              <Text style={styles.routeCloseButtonText}>지우기</Text>
            </Pressable>
          </View>
          <View style={styles.shadeBadgeRow}>
            <View style={styles.shadeBadge}>
              <Text style={styles.shadeBadgeText}>
                🌳 그늘 {Math.round(displayShadeRatio * 100)}%
              </Text>
            </View>
            <View style={styles.shadeBadge}>
              <Text style={styles.shadeBadgeText}>
                ☀️ 최대 연속노출 {displayMaxExposure}초
              </Text>
            </View>
          </View>
          {shadeForecast && shadeForecast.length > 0 && (
            <View style={styles.forecastRow}>
              <Text style={styles.forecastLabel}>
                🕐{' '}
                {selectedOffsetMinutes === 0
                  ? '지금'
                  : selectedOffsetMinutes < 60
                    ? `${selectedOffsetMinutes}분 후`
                    : `${(selectedOffsetMinutes / 60).toFixed(selectedOffsetMinutes % 60 === 0 ? 0 : 1)}시간 후`}{' '}
                기준 · 슬라이더로 다른 시간대 그늘도 볼 수 있어요
              </Text>
              <Slider
                style={styles.forecastSlider}
                minimumValue={0}
                maximumValue={180}
                step={30}
                value={selectedOffsetMinutes}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbTintColor={Colors.primary}
                onValueChange={(v: number) => setSelectedOffsetMinutes(Math.round(v / 30) * 30)}
              />
              <View style={styles.forecastSliderLabels}>
                <Text style={styles.forecastSliderLabelText}>지금</Text>
                <Text style={styles.forecastSliderLabelText}>1시간</Text>
                <Text style={styles.forecastSliderLabelText}>2시간</Text>
                <Text style={styles.forecastSliderLabelText}>3시간</Text>
              </View>
            </View>
          )}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SHADE_COLOR }]} />
              <Text style={styles.legendText}>건물그림자(추정)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: EXPOSED_COLOR }]} />
              <Text style={styles.legendText}>노출</Text>
            </View>
          </View>
          {selectedOffsetMinutes === 0 && route.warning && (
            <Text style={styles.routeWarning}>{route.warning}</Text>
          )}
        </View>
      ) : travelMode === 'TRANSIT' && selectedItinerary ? (
        <View style={styles.routeSummary}>
          <View style={styles.routeSummaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeSummaryTitle}>🚌 {routeTargetName}까지</Text>
              <Text style={styles.routeSummaryDetail}>
                {formatDuration(selectedItinerary.totalTime)} · {selectedItinerary.totalFare.toLocaleString()}원 ·
                환승 {selectedItinerary.transferCount}회
              </Text>
            </View>
            <Pressable style={styles.routeCloseButton} onPress={clearRoute}>
              <Text style={styles.routeCloseButtonText}>지우기</Text>
            </Pressable>
          </View>

          {transitItineraries && transitItineraries.length > 1 && (
            <View style={styles.optionRow}>
              {transitItineraries.map((it, idx) => (
                <Pressable
                  key={idx}
                  style={[styles.optionChip, selectedTransitIndex === idx && styles.optionChipActive]}
                  onPress={() => setSelectedTransitIndex(idx)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      selectedTransitIndex === idx && styles.optionChipTextActive,
                    ]}
                  >
                    옵션{idx + 1} · {formatDuration(it.totalTime)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.legList}>
            {selectedItinerary.legs.map((leg, idx) => (
              <View key={idx} style={styles.legRow}>
                <Text style={styles.legIcon}>{legIcon(leg.mode)}</Text>
                <Text style={styles.legLabel} numberOfLines={1}>
                  {legLabel(leg)}
                </Text>
                {idx < selectedItinerary.legs.length - 1 && <Text style={styles.legArrow}>→</Text>}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Pressable style={styles.guideButton} onPress={handleGuideToNearest} disabled={routeLoading}>
          <Text style={styles.guideButtonText}>
            {routeLoading ? '경로 찾는 중...' : '🧭 가장 가까운 곳으로 안내'}
          </Text>
        </Pressable>
      )}

      <StoreDetailModal
        store={selectedStore}
        visible={storeModalVisible}
        onClose={() => setStoreModalVisible(false)}
        onGuide={(store) => {
          setStoreModalVisible(false);
          chooseModeAndGuide({ lat: store.lat, lng: store.lng, name: store.name });
        }}
      />
      <ShelterDetailModal
        shelter={selectedShelter}
        visible={shelterModalVisible}
        onClose={() => setShelterModalVisible(false)}
        onGuide={(shelter) => {
          setShelterModalVisible(false);
          chooseModeAndGuide({ lat: shelter.lat, lng: shelter.lng, name: shelter.name });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingBadge: { position: 'absolute', top: 16, right: 16 },
  weatherBadge: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  weatherBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  filterBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  filterChipTextActive: { color: Colors.textOnPrimary },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 130,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  recenterButtonIcon: { fontSize: 20 },
  routeStartDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.background,
  },
  routeEndFlag: { fontSize: 28 },
  transferDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 3,
  },
  guideButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  guideButtonText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 15 },
  routeSummary: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    maxHeight: 260,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  routeSummaryHeader: { flexDirection: 'row', alignItems: 'center' },
  routeSummaryTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  routeSummaryDetail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  routeCloseButton: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  routeCloseButtonText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  shadeBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  shadeBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  shadeBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.primaryDark },
  forecastRow: { marginTop: 10 },
  forecastLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  forecastSlider: { width: '100%', height: 32 },
  forecastSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  forecastSliderLabelText: { fontSize: 10, color: Colors.textSecondary },
  legendRow: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.textSecondary },
  routeWarning: { fontSize: 12, color: Colors.danger, marginTop: 8 },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  optionChip: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  optionChipActive: { backgroundColor: Colors.primary },
  optionChipText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  optionChipTextActive: { color: Colors.textOnPrimary },
  legList: { marginTop: 10 },
  legRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 6 },
  legIcon: { fontSize: 14 },
  legLabel: { fontSize: 12, color: Colors.textPrimary, flexShrink: 1 },
  legArrow: { fontSize: 12, color: Colors.neutral },
});
