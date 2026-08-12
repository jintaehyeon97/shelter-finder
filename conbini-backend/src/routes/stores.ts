import { Router, Request, Response } from 'express';
import { fetchNearbyConvenienceStores, searchConvenienceStoresByKeyword } from '../utils/kakaoLocal';

const router = Router();

/**
 * GET /stores/nearby?lat=&lng=&radius=
 * 반경 내 편의점을 카카오 로컬 API로 실시간 조회 (기본 반경 1000m)
 */
router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius as string) ?? '1000');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat, lng 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const stores = await fetchNearbyConvenienceStores(lat, lng, radius);
    res.json(stores);
  } catch (err: any) {
    console.error('카카오 조회 실패:', err.response?.data ?? err.message);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /stores/search?q=&lat=&lng=
 * 상호명/지역명 검색을 카카오 로컬 API로 실시간 조회
 * lat/lng을 같이 넘기면 그 위치 근처 위주로(거리순) 검색됩니다.
 */
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 1) {
    return res.json([]);
  }

  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const hasLocation = !Number.isNaN(lat) && !Number.isNaN(lng);

  try {
    const stores = await searchConvenienceStoresByKeyword(
      q,
      hasLocation ? lat : undefined,
      hasLocation ? lng : undefined
    );
    res.json(stores);
  } catch (err: any) {
    console.error('카카오 검색 실패:', err.response?.data ?? err.message);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

export default router;
