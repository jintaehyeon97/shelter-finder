import axios from 'axios';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  coordinates: LatLng[];
  distance: number; // 미터
  time: number; // 초
}

export interface RouteResult {
  totalDistance: number;
  totalTime: number;
  path: LatLng[];
  segments: RouteSegment[];
}

const TMAP_APP_KEY = process.env.TMAP_APP_KEY ?? '';

/**
 * TMAP 보행자 경로 API를 호출합니다.
 * waypoints를 넘기면 해당 지점들을 경유하는 경로를 계산합니다.
 */
export async function callTmapPedestrian(
  origin: LatLng,
  dest: LatLng,
  destName: string,
  waypoints: LatLng[] = []
): Promise<RouteResult> {
  if (!TMAP_APP_KEY) {
    throw new Error('TMAP_APP_KEY가 설정되어 있지 않습니다.');
  }

  const body: Record<string, string> = {
    startX: String(origin.longitude),
    startY: String(origin.latitude),
    endX: String(dest.longitude),
    endY: String(dest.latitude),
    startName: encodeURIComponent('출발지'),
    endName: encodeURIComponent(destName || '목적지'),
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
  };

  if (waypoints.length > 0) {
    body.passList = waypoints.map((w) => `${w.longitude},${w.latitude}`).join('_');
  }

  const { data } = await axios.post(
    'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1',
    body,
    {
      headers: {
        appKey: TMAP_APP_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const features = data?.features ?? [];
  let totalDistance = 0;
  let totalTime = 0;
  const path: LatLng[] = [];
  const segments: RouteSegment[] = [];

  for (const feature of features) {
    if (feature.properties?.totalDistance) {
      totalDistance = feature.properties.totalDistance;
    }
    if (feature.properties?.totalTime) {
      totalTime = feature.properties.totalTime;
    }
    if (feature.geometry?.type === 'LineString') {
      const coords: LatLng[] = feature.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
      );
      coords.forEach((c) => path.push(c));
      segments.push({
        coordinates: coords,
        distance: feature.properties?.distance ?? 0,
        time: feature.properties?.time ?? 0,
      });
    }
  }

  return { totalDistance, totalTime, path, segments };
}
