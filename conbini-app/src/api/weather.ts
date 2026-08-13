import apiClient from '@/api/client';
import { CurrentWeather } from '@/types/weather';

export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  const { data } = await apiClient.get<CurrentWeather>('/weather/current', {
    params: { lat, lng },
  });
  return data;
}
