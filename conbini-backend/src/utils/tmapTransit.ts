import axios from 'axios';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TransitLeg {
  mode: string; // WALK, BUS, SUBWAY 등
  sectionTime: number; // 초
  distance: number; // 미터
  routeName?: string; // 예: "간선:472"
  routeColor?: string; // 예: "0068B7"
  startName: string;
  endName: string;
  path: LatLng[];
}

export interface TransitItinerary {
  totalTime: number; // 초
  totalFare: number; // 원
  transferCount: number;
  totalWalkTime: number;
  totalWalkDistance: number;
  totalDistance: number;
  legs: TransitLeg[];
}

const TMAP_TRANSIT_APP_KEY = process.env.TMAP_TRANSIT_APP_KEY ?? '';

/** "lon,lat lon,lat ..." 형태의 문자열을 좌표 배열로 변환 */
function parseLinestring(linestring?: string): LatLng[] {
  if (!linestring) return [];
  return linestring
    .trim()
    .split(' ')
    .map((pair) => {
      const [lng, lat] = pair.split(',').map(Number);
      return { latitude: lat, longitude: lng };
    })
    .filter((p) => !Number.isNaN(p.latitude) && !Number.isNaN(p.longitude));
}

function extractLegPath(leg: any): LatLng[] {
  if (leg.passShape?.linestring) {
    return parseLinestring(leg.passShape.linestring);
  }
  if (Array.isArray(leg.steps)) {
    const path: LatLng[] = [];
    for (const step of leg.steps) {
      path.push(...parseLinestring(step.linestring));
    }
    return path;
  }
  // 좌표 정보가 전혀 없으면 최소한 시작/끝 점이라도 반환
  const start = leg.start;
  const end = leg.end;
  if (start && end) {
    return [
      { latitude: start.lat, longitude: start.lon },
      { latitude: end.lat, longitude: end.lon },
    ];
  }
  return [];
}

export async function callTmapTransit(
  origin: LatLng,
  dest: LatLng,
  count = 2
): Promise<TransitItinerary[]> {
  if (!TMAP_TRANSIT_APP_KEY) {
    throw new Error('TMAP_TRANSIT_APP_KEY가 설정되어 있지 않습니다.');
  }

  const { data } = await axios.post(
    'https://apis.openapi.sk.com/transit/routes',
    {
      startX: String(origin.longitude),
      startY: String(origin.latitude),
      endX: String(dest.longitude),
      endY: String(dest.latitude),
      count,
      lang: 0,
      format: 'json',
    },
    {
      headers: {
        appKey: TMAP_TRANSIT_APP_KEY,
      },
    }
  );

  const itineraries = data?.metaData?.plan?.itineraries ?? [];

  return itineraries.map((it: any): TransitItinerary => {
    const legs: TransitLeg[] = (it.legs ?? [])
      .filter((leg: any) => !(leg.mode === 'WALK' && leg.sectionTime === 0 && leg.distance === 0))
      .map((leg: any) => ({
        mode: leg.mode,
        sectionTime: leg.sectionTime ?? 0,
        distance: leg.distance ?? 0,
        routeName: leg.route,
        routeColor: leg.routeColor,
        startName: leg.start?.name ?? '',
        endName: leg.end?.name ?? '',
        path: extractLegPath(leg),
      }));

    return {
      totalTime: it.totalTime ?? 0,
      totalFare: it.fare?.regular?.totalFare ?? 0,
      transferCount: it.transferCount ?? 0,
      totalWalkTime: it.totalWalkTime ?? 0,
      totalWalkDistance: it.totalWalkDistance ?? 0,
      totalDistance: it.totalDistance ?? 0,
      legs,
    };
  });
}
