import proj4 from 'proj4';

// safemap.go.kr 데이터의 x, y는 Web Mercator(EPSG:3857) 좌표입니다.
proj4.defs(
  'EPSG:3857',
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs'
);

export function convertToWGS84(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [x, y]);
  return { lat, lng };
}

export function isInsideKorea(lat: number, lng: number): boolean {
  return lat > 33 && lat < 43 && lng > 124 && lng < 132;
}