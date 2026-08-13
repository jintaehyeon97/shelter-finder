import { Router, Request, Response } from 'express';
import axios from 'axios';
import { latLngToGrid } from '../utils/kmaGrid';

const router = Router();
const KMA_API_KEY = process.env.KMA_API_KEY ?? '';

function getBaseDateTime(): { baseDate: string; baseTime: string } {
  const now = new Date();
  // 초단기실황은 매시 40분에 그 시각 데이터가 갱신됨. 40분 전이면 이전 시각 데이터를 씀.
  if (now.getMinutes() < 40) {
    now.setHours(now.getHours() - 1);
  }
  const baseDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const baseTime = `${String(now.getHours()).padStart(2, '0')}00`;
  return { baseDate, baseTime };
}

/**
 * GET /weather/current?lat=&lng=
 * 기상청 초단기실황 API로 현재 기온/습도 등을 조회합니다.
 */
router.get('/current', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat, lng 쿼리 파라미터가 필요합니다.' });
  }

  const { nx, ny } = latLngToGrid(lat, lng);
  const { baseDate, baseTime } = getBaseDateTime();

  try {
    const { data } = await axios.get(
      'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst',
      {
        params: {
          serviceKey: KMA_API_KEY,
          pageNo: 1,
          numOfRows: 10,
          dataType: 'JSON',
          base_date: baseDate,
          base_time: baseTime,
          nx,
          ny,
        },
        timeout: 5000,
      }
    );

    if (data?.response?.header?.resultCode !== '00') {
      return res.status(502).json({ error: '기상청 API 오류', detail: data?.response?.header?.resultMsg });
    }

    const items: any[] = data?.response?.body?.items?.item ?? [];
    const find = (category: string) => items.find((i) => i.category === category)?.obsrValue;

    res.json({
      temperature: find('T1H') ? parseFloat(find('T1H')) : null, // 기온(℃)
      humidity: find('REH') ? parseFloat(find('REH')) : null, // 습도(%)
      precipitationType: find('PTY') ?? null, // 강수형태 코드
      observedAt: `${baseDate} ${baseTime}`,
    });
  } catch (err: any) {
    console.error('기상청 조회 실패:', err.response?.data ?? err.message);
    res.status(500).json({ error: '날씨 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
