import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * GET /favorites?userId=
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.brand, s.address, s.road_address AS "roadAddress",
              ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng
       FROM favorites f
       JOIN convenience_stores s ON s.id = f.store_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '즐겨찾기 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /favorites  body: { userId, storeId }
 */
router.post('/', async (req: Request, res: Response) => {
  const { userId, storeId } = req.body ?? {};
  if (!userId || !storeId) {
    return res.status(400).json({ error: 'userId, storeId는 필수입니다.' });
  }

  try {
    await pool.query(
      `INSERT INTO favorites (user_id, store_id) VALUES ($1, $2)
       ON CONFLICT (user_id, store_id) DO NOTHING`,
      [userId, storeId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '즐겨찾기 추가 중 오류가 발생했습니다.' });
  }
});

/**
 * DELETE /favorites  body: { userId, storeId }
 */
router.delete('/', async (req: Request, res: Response) => {
  const { userId, storeId } = req.body ?? {};
  if (!userId || !storeId) {
    return res.status(400).json({ error: 'userId, storeId는 필수입니다.' });
  }

  try {
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND store_id = $2', [
      userId,
      storeId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '즐겨찾기 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
