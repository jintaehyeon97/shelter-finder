import apiClient from '@/api/client';
import { WalkingRoute } from '@/types/directions';
import { ShadyRoute, ShadySegment, ShadeSummary } from '@/types/shadyRoute';
import { TransitItinerary } from '@/types/transit';

export async function fetchWalkingRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  toName?: string
): Promise<WalkingRoute> {
  const { data } = await apiClient.get<WalkingRoute>('/directions/walking', {
    params: {
      fromLat: from.latitude,
      fromLng: from.longitude,
      toLat: to.latitude,
      toLng: to.longitude,
      toName,
    },
  });
  return data;
}

export async function fetchShadyWalkingRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  toName?: string
): Promise<ShadyRoute> {
  const { data } = await apiClient.get<ShadyRoute>('/directions/shady-walking', {
    params: {
      fromLat: from.latitude,
      fromLng: from.longitude,
      toLat: to.latitude,
      toLng: to.longitude,
      toName,
    },
  });
  return data;
}

export async function fetchTransitRoutes(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  count = 2
): Promise<TransitItinerary[]> {
  const { data } = await apiClient.get<{ itineraries: TransitItinerary[] }>('/directions/transit', {
    params: {
      fromLat: from.latitude,
      fromLng: from.longitude,
      toLat: to.latitude,
      toLng: to.longitude,
      count,
    },
  });
  return data.itineraries;
}

export interface ReclassifyShadeResult {
  segments: ShadySegment[];
  shadeSummary: ShadeSummary;
  warning: string | null;
  sun: { altitudeDeg: number; azimuthDeg: number };
}

/**
 * 이미 받아둔 경로(TMAP 재호출 없이)의 그늘 판정만 현재 시각 기준으로 다시 계산합니다.
 * 시간이 지나 태양 위치가 바뀌었을 때 가볍게 갱신하는 용도입니다.
 */
export async function reclassifyShade(
  origin: { latitude: number; longitude: number },
  segments: { coordinates: { latitude: number; longitude: number }[]; distance: number; time: number }[]
): Promise<ReclassifyShadeResult> {
  const { data } = await apiClient.post<ReclassifyShadeResult>('/directions/reclassify-shade', {
    originLat: origin.latitude,
    originLng: origin.longitude,
    segments,
  });
  return data;
}

export interface ShadeForecastEntry {
  offsetMinutes: number; // 0, 30, 60, 90, 120, 150, 180 (분 단위)
  shadeRatio: number; // 0~1
  maxContinuousExposureSec: number;
  segments: ShadySegment[];
}

/**
 * 같은 경로를 여러 시간대(지금/1시간후/3시간후) 기준으로 그늘 비율을 비교합니다.
 */
export async function fetchShadeForecast(
  origin: { latitude: number; longitude: number },
  segments: { coordinates: { latitude: number; longitude: number }[]; distance: number; time: number }[]
): Promise<ShadeForecastEntry[]> {
  const { data } = await apiClient.post<{ forecasts: ShadeForecastEntry[] }>(
    '/directions/shade-forecast',
    { originLat: origin.latitude, originLng: origin.longitude, segments }
  );
  return data.forecasts;
}
