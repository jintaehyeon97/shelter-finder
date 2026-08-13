export interface CurrentWeather {
  temperature: number | null; // 섭씨
  humidity: number | null; // %
  precipitationType: string | null;
  observedAt: string;
}
