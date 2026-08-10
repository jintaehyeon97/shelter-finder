import apiClient from '@/api/client';
import { Shelter } from '@/types/shelter';

export async function fetchNearbyShelters(
  lat: number,
  lng: number,
  radiusMeters: number,
  category?: string
): Promise<Shelter[]> {
  const { data } = await apiClient.get<Shelter[]>('/shelters/nearby', {
    params: { lat, lng, radius: radiusMeters, category },
  });
  return data;
}

export async function searchShelters(keyword: string, category?: string): Promise<Shelter[]> {
  const { data } = await apiClient.get<Shelter[]>('/shelters/search', {
    params: { q: keyword, category },
  });
  return data;
}
