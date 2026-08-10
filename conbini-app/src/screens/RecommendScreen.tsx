import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useCurrentLocation } from '@/hooks/useLocation';
import { fetchNearbyStores } from '@/api/stores';
import { fetchNearbyShelters } from '@/api/shelters';
import { ConvenienceStore } from '@/types/store';
import { Shelter } from '@/types/shelter';
import { RootTabParamList } from '@/navigation/RootNavigator';
import { Colors } from '@/theme/colors';

type Nav = BottomTabNavigationProp<RootTabParamList>;

type RecommendItem =
  | { type: 'store'; id: string; name: string; address?: string; distance?: number; data: ConvenienceStore }
  | { type: 'shelter'; id: string; name: string; address?: string; distance?: number; data: Shelter };

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export default function RecommendScreen() {
  const navigation = useNavigation<Nav>();
  const { location, errorMsg, loading: locLoading } = useCurrentLocation();
  const [items, setItems] = useState<RecommendItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    Promise.all([
      fetchNearbyStores(location.latitude, location.longitude, 1500),
      fetchNearbyShelters(location.latitude, location.longitude, 1500, '무더위쉼터'),
    ])
      .then(([stores, shelters]) => {
        const storeItems: RecommendItem[] = stores.map((s) => ({
          type: 'store',
          id: `store-${s.id}`,
          name: s.name,
          address: s.roadAddress || s.address,
          distance: s.distance,
          data: s,
        }));
        const shelterItems: RecommendItem[] = shelters.map((s) => ({
          type: 'shelter',
          id: `shelter-${s.id}`,
          name: s.name,
          address: s.roadAddress || s.address,
          distance: s.distance,
          data: s,
        }));
        const combined = [...storeItems, ...shelterItems].sort(
          (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
        );
        setItems(combined);
      })
      .catch((e) => console.warn('추천 목록 조회 실패', e))
      .finally(() => setLoading(false));
  }, [location]);

  const handlePress = (item: RecommendItem) => {
    if (item.type === 'store') {
      navigation.navigate('Map', { focusStore: item.data, navKey: Date.now() });
    } else {
      navigation.navigate('Map', { focusShelter: item.data, navKey: Date.now() });
    }
  };

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

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => handlePress(item)}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemIcon}>{item.type === 'store' ? '🏪' : '🌡️'}</Text>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemAddress} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            </View>
            <Text style={styles.itemDistance}>
              {item.distance != null ? formatDistance(item.distance) : ''}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>주변에 표시할 장소가 없어요.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  itemIcon: { fontSize: 20 },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  itemAddress: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemDistance: { fontSize: 13, color: Colors.primaryDark, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
});
