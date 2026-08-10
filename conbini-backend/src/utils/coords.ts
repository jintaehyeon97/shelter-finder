import proj4 from 'proj4';

// safemap.go.kr 데이터의 x, y는 Web Mercator(EPSG:3857) 좌표입니다.
// (예: x=14113089.99, y=4546849.533 처럼 값이 매우 큰 것이 특징)
proj4.defs(
  'EPSG:3857',
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs'
);

/**
 * Web Mercator(EPSG:3857) 좌표(x, y)를 WGS84 위경도(lat, lng)로 변환합니다.
 * 변환 후 대한민국 범위(위도 33~43, 경도 124~132)를 벗어나면 원본 좌표계가
 * 다를 수 있으니, 데이터 출처의 좌표계 설명을 다시 확인하세요.
 */
export function convertToWGS84(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [x, y]);
  return { lat, lng };
}

export function isInsideKorea(lat: number, lng: number): boolean {
  return lat > 33 && lat < 43 && lng > 124 && lng < 132;
}
