import apiClient from '@/api/client';
import { ConvenienceStore } from '@/types/store';

export async function fetchNearbyStores(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<ConvenienceStore[]> {
  const { data } = await apiClient.get<ConvenienceStore[]>('/stores/nearby', {
    params: { lat, lng, radius: radiusMeters },
  });
  return data;
}

export async function searchStores(keyword: string): Promise<ConvenienceStore[]> {
  const { data } = await apiClient.get<ConvenienceStore[]>('/stores/search', {
    params: { q: keyword },
  });
  return data;
}
