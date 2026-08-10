import { Router, Request, Response } from 'express';
import { callTmapPedestrian, LatLng, RouteSegment } from '../utils/tmap';
import { callTmapTransit } from '../utils/tmapTransit';
import { bearingDegrees } from '../utils/geo';
import { getSolarPosition, SolarPosition } from '../utils/solar';

const router = Router();

/**
 * GET /directions/transit?fromLat=&fromLng=&toLat=&toLng=&count=
 * 대중교통(버스/지하철) 경로 옵션들을 반환합니다.
 */
router.get('/transit', async (req: Request, res: Response) => {
  const fromLat = parseFloat(req.query.fromLat as string);
  const fromLng = parseFloat(req.query.fromLng as string);
  const toLat = parseFloat(req.query.toLat as string);
  const toLng = parseFloat(req.query.toLng as string);
  const count = req.query.count ? parseInt(req.query.count as string, 10) : 2;

  if ([fromLat, fromLng, toLat, toLng].some((v) => Number.isNaN(v))) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng가 필요합니다.' });
  }

  try {
    const itineraries = await callTmapTransit(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
      count
    );
    res.json({ itineraries });
  } catch (err: any) {
    console.error('대중교통 경로 조회 실패:', err.response?.data ?? err.message);
    res.status(500).json({ error: '대중교통 경로 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /directions/walking?fromLat=&fromLng=&toLat=&toLng=&toName=
 * 단순 최단 도보 경로
 */
router.get('/walking', async (req: Request, res: Response) => {
  const fromLat = parseFloat(req.query.fromLat as string);
  const fromLng = parseFloat(req.query.fromLng as string);
  const toLat = parseFloat(req.query.toLat as string);
  const toLng = parseFloat(req.query.toLng as string);
  const toName = (req.query.toName as string) || '목적지';

  if ([fromLat, fromLng, toLat, toLng].some((v) => Number.isNaN(v))) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng가 필요합니다.' });
  }

  try {
    const result = await callTmapPedestrian(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
      toName
    );
    res.json({ totalDistance: result.totalDistance, totalTime: result.totalTime, path: result.path });
  } catch (err: any) {
    console.error('TMAP 요청 실패:', err.response?.data ?? err.message);
    res.status(500).json({ error: '경로 조회 중 오류가 발생했습니다.' });
  }
});

// ── 그늘 정보가 포함된 경로 ──────────────────────────────────────
// 실제 경로를 바꾸는 우회는 하지 않고, 최단경로 구간마다 태양 위치 기반으로
// '건물 그림자가 도로를 덮을 가능성'을 추정해 그늘/노출 여부만 계산합니다.

const MAX_CONTINUOUS_EXPOSURE_SEC = 180; // 연속 직사광선 노출 기준: 3분 (참고용 지표)

interface ClassifiedSegment extends RouteSegment {
  isShaded: boolean;
  source: 'building' | 'none';
}

function segmentMidpoint(seg: RouteSegment): LatLng {
  return seg.coordinates[Math.floor(seg.coordinates.length / 2)];
}

function foldTo180(deg: number): number {
  return ((deg % 180) + 180) % 180;
}

const ASSUMED_BUILDING_HEIGHT_M = 15; // 국내 저층~중층 시가지 평균 근사값
const STREET_HALF_WIDTH_M = 6; // 그림자가 도로 절반 이상 덮으면 '그늘'로 판정

/**
 * 도로 방향과 태양 방위각의 기하학적 관계로 '건물 그림자가 도로를 덮을 가능성'을 추정합니다.
 * 실제 건물 데이터는 없으므로, 도로 양옆에 평균 높이의 건물이 늘어서 있다고 가정한 근사치입니다.
 */
function isBuildingShadeLikely(roadBearingDeg: number, sun: SolarPosition): boolean {
  if (sun.altitudeDeg <= 0) return true; // 해가 진 상태
  if (sun.altitudeDeg >= 85) return false; // 태양이 거의 정중앙 - 그림자 매우 짧음

  const roadMod = foldTo180(roadBearingDeg);
  const sunMod = foldTo180(sun.azimuthDeg);
  let diff = Math.abs(roadMod - sunMod);
  if (diff > 90) diff = 180 - diff;

  const altitudeRad = (sun.altitudeDeg * Math.PI) / 180;
  const shadowLength = ASSUMED_BUILDING_HEIGHT_M / Math.tan(altitudeRad);
  const crossStreetComponent = shadowLength * Math.sin((diff * Math.PI) / 180);

  return crossStreetComponent >= STREET_HALF_WIDTH_M;
}

function classifySegments(segments: RouteSegment[], sun: SolarPosition): ClassifiedSegment[] {
  return segments.map((seg) => {
    let buildingShade = false;
    if (seg.coordinates.length >= 2) {
      const bearing = bearingDegrees(seg.coordinates[0], seg.coordinates[seg.coordinates.length - 1]);
      buildingShade = isBuildingShadeLikely(bearing, sun);
    }
    return { ...seg, isShaded: buildingShade, source: buildingShade ? 'building' : 'none' };
  });
}

interface ExposureStats {
  totalShadedTime: number;
  totalExposedTime: number;
  maxContinuousExposure: number;
}

function computeExposureStats(segments: ClassifiedSegment[]): ExposureStats {
  let totalShadedTime = 0;
  let totalExposedTime = 0;
  let currentRunTime = 0;
  let maxContinuousExposure = 0;

  for (const seg of segments) {
    if (seg.isShaded) {
      totalShadedTime += seg.time;
      if (currentRunTime > maxContinuousExposure) maxContinuousExposure = currentRunTime;
      currentRunTime = 0;
    } else {
      totalExposedTime += seg.time;
      currentRunTime += seg.time;
    }
  }
  if (currentRunTime > maxContinuousExposure) maxContinuousExposure = currentRunTime;

  return { totalShadedTime, totalExposedTime, maxContinuousExposure };
}

/**
 * GET /directions/shady-walking?fromLat=&fromLng=&toLat=&toLng=&toName=
 * 최단 도보 경로를 계산하고, 구간마다 건물그림자 추정으로 그늘/노출 정보를 덧붙여 반환합니다.
 */
router.get('/shady-walking', async (req: Request, res: Response) => {
  const fromLat = parseFloat(req.query.fromLat as string);
  const fromLng = parseFloat(req.query.fromLng as string);
  const toLat = parseFloat(req.query.toLat as string);
  const toLng = parseFloat(req.query.toLng as string);
  const toName = (req.query.toName as string) || '목적지';

  if ([fromLat, fromLng, toLat, toLng].some((v) => Number.isNaN(v))) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng가 필요합니다.' });
  }

  const origin: LatLng = { latitude: fromLat, longitude: fromLng };
  const dest: LatLng = { latitude: toLat, longitude: toLng };

  try {
    const route = await callTmapPedestrian(origin, dest, toName);
    const sun = getSolarPosition(new Date(), origin.latitude, origin.longitude);
    const segments = classifySegments(route.segments, sun);
    const stats = computeExposureStats(segments);

    const warning =
      stats.maxContinuousExposure > MAX_CONTINUOUS_EXPOSURE_SEC
        ? '이 경로는 연속 직사광선 노출이 3분을 넘는 구간이 있어요. 그늘막이나 양산을 챙기는 걸 추천해요.'
        : null;

    res.json({
      totalDistance: route.totalDistance,
      totalTime: route.totalTime,
      path: route.path,
      segments: segments.map((s) => ({
        coordinates: s.coordinates,
        isShaded: s.isShaded,
        source: s.source,
      })),
      shadeSummary: {
        totalShadedTime: Math.round(stats.totalShadedTime),
        totalExposedTime: Math.round(stats.totalExposedTime),
        maxContinuousExposureSec: Math.round(stats.maxContinuousExposure),
        shadeRatio: route.totalTime > 0 ? stats.totalShadedTime / route.totalTime : 0,
      },
      warning,
      sun: {
        altitudeDeg: Math.round(sun.altitudeDeg * 10) / 10,
        azimuthDeg: Math.round(sun.azimuthDeg * 10) / 10,
      },
    });
  } catch (err: any) {
    console.error('그늘 경로 계산 실패:', err.response?.data ?? err.message);
    res.status(500).json({ error: '경로 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
