import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * GET /shelters/nearby?lat=&lng=&radius=&category=
 * category 생략 시 전체 카테고리(무더위쉼터, 한파쉼터 등) 반환
 */
router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius as string) ?? '1000');
  const category = req.query.category as string | undefined;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat, lng 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         id, category, facility_type AS "facilityType", name, address,
         road_address AS "roadAddress", capacity, has_fan AS "hasFan", has_aircon AS "hasAircon",
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
         ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
       FROM shelters
       WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
         AND ($4::varchar IS NULL OR category = $4)
       ORDER BY distance
       LIMIT 200`,
      [lng, lat, radius, category ?? null]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /shelters/search?q=&category=
 * 이름/주소 검색. category 생략 시 전체 카테고리 대상
 */
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  const category = req.query.category as string | undefined;
  if (!q || q.length < 1) {
    return res.json([]);
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         id, category, facility_type AS "facilityType", name, address,
         road_address AS "roadAddress", capacity, has_fan AS "hasFan", has_aircon AS "hasAircon",
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM shelters
       WHERE (name ILIKE '%' || $1 || '%'
          OR address ILIKE '%' || $1 || '%'
          OR road_address ILIKE '%' || $1 || '%')
         AND ($2::varchar IS NULL OR category = $2)
       LIMIT 50`,
      [q, category ?? null]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

export default router;
