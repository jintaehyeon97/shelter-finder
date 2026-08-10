import axios from 'axios';
import dotenv from 'dotenv';
import { pool } from '../db';
import { isInsideKorea } from '../utils/coords';

dotenv.config();

/**
 * 사용법: npm run seed:parks
 *
 * data.go.kr의 전국도시공원정보표준데이터 API를 페이징 호출해서
 * 전국 공원 데이터를 모두 받아와 DB에 upsert합니다.
 * (이 API는 위도/경도를 바로 제공하므로 좌표변환이 필요 없습니다.)
 */

const SERVICE_KEY = process.env.PUBLIC_DATA_API_KEY_PARK ?? process.env.PUBLIC_DATA_API_KEY ?? '';
const PAGE_SIZE = 1000; // 이 API의 numOfRows 최대값

interface ApiItem {
  manageNo: string;
  parkNm: string;
  parkSe: string;
  rdnmadr: string;
  lnmadr: string;
  latitude: string;
  longitude: string;
  parkAr: string;
}

async function fetchPage(pageNo: number): Promise<{ items: ApiItem[]; totalCount: number }> {
  const { data } = await axios.get(
    'https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api',
    {
      params: {
        serviceKey: SERVICE_KEY,
        pageNo,
        numOfRows: PAGE_SIZE,
        type: 'json',
      },
    }
  );

  if (data?.header?.resultCode !== '00') {
    throw new Error(`API 오류: ${data?.header?.resultMsg ?? '알 수 없는 오류'}`);
  }

  const rawItems = data?.body?.items?.item ?? [];
  const items: ApiItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];
  const totalCount = data?.body?.totalCount ?? 0;

  return { items, totalCount };
}

async function seed() {
  if (!SERVICE_KEY) {
    console.error('PUBLIC_DATA_API_KEY(_PARK)가 .env에 설정되어 있지 않습니다.');
    process.exit(1);
  }

  console.log('1페이지 호출해서 전체 건수 확인 중...');
  const first = await fetchPage(1);
  const totalCount = first.totalCount;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  console.log(`총 ${totalCount}건, ${totalPages}페이지 처리 예정`);

  let success = 0;
  let skipped = 0;

  const processItems = async (items: ApiItem[]) => {
    for (const row of items) {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      if (!lat || !lng || !isInsideKorea(lat, lng)) {
        skipped++;
        continue;
      }
      if (!row.manageNo) {
        skipped++;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO parks
             (manage_no, name, park_type, address, road_address, area, location)
           VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($7, $8)::geography)
           ON CONFLICT (manage_no) DO UPDATE SET
             name = EXCLUDED.name,
             park_type = EXCLUDED.park_type,
             address = EXCLUDED.address,
             road_address = EXCLUDED.road_address,
             area = EXCLUDED.area,
             location = EXCLUDED.location`,
          [
            row.manageNo,
            row.parkNm || null,
            row.parkSe || null,
            row.lnmadr || null,
            row.rdnmadr || null,
            row.parkAr ? parseFloat(row.parkAr) : null,
            lng,
            lat,
          ]
        );
        success++;
      } catch (err) {
        console.error(`저장 실패 (manageNo=${row.manageNo}):`, err);
        skipped++;
      }
    }
  };

  await processItems(first.items);
  console.log(`페이지 1/${totalPages} 처리 완료 (누적 성공 ${success}, 건너뜀 ${skipped})`);

  for (let page = 2; page <= totalPages; page++) {
    const { items } = await fetchPage(page);
    await processItems(items);
    console.log(`페이지 ${page}/${totalPages} 처리 완료 (누적 성공 ${success}, 건너뜀 ${skipped})`);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n전체 완료: 성공 ${success}건, 건너뜀 ${skipped}건`);
  await pool.end();
}

seed().catch((err) => {
  console.error('시딩 실패:', err);
  process.exit(1);
});
