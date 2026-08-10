import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * GET /stores/nearby?lat=&lng=&radius=
 * 반경 내 편의점 조회 (기본 반경 1000m)
 */
router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius as string) ?? '1000');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat, lng 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         id, name, brand, address, road_address AS "roadAddress",
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
         ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
       FROM convenience_stores
       WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
         AND verify_miss_count < 2
       ORDER BY distance
       LIMIT 200`,
      [lng, lat, radius]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /stores/search?q=
 * 상호명/주소 검색
 */
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 1) {
    return res.json([]);
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         id, name, brand, address, road_address AS "roadAddress",
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM convenience_stores
       WHERE (name ILIKE '%' || $1 || '%'
          OR address ILIKE '%' || $1 || '%'
          OR road_address ILIKE '%' || $1 || '%')
         AND verify_miss_count < 2
       LIMIT 50`,
      [q]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

export default router;
