import apiClient from '@/api/client';
import { WalkingRoute } from '@/types/directions';
import { ShadyRoute } from '@/types/shadyRoute';
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
