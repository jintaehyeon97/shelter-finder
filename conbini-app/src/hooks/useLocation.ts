import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

interface Coords {
  latitude: number;
  longitude: number;
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<Coords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const fetchLocation = useCallback(async (): Promise<Coords | null> => {
    try {
      const position = await Location.getCurrentPositionAsync({});
      const coords: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(coords);
      setErrorMsg(null);
      return coords;
    } catch (e) {
      setErrorMsg('위치를 가져오는 데 실패했습니다.');
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('위치 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.');
        setLoading(false);
        return;
      }

      await fetchLocation();
      setLoading(false);

      // 걷는 동안 위치가 바뀔 때마다 자동으로 갱신 (15m 이상 이동 또는 5초마다)
      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
        (position) => {
          if (!mounted) return;
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      );
    })();

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
    };
  }, [fetchLocation]);

  return { location, errorMsg, loading, refresh: fetchLocation };
}
