import axios from 'axios';
import dotenv from 'dotenv';
import { pool } from '../db';
import { convertToWGS84, isInsideKorea } from '../utils/coords';

dotenv.config();

/**
 * 사용법: npm run seed:heat-shelters
 *
 * safemap.go.kr의 IF_0001(무더위쉼터) API를 페이징 호출해서
 * 전국 무더위쉼터 데이터를 모두 받아와 DB에 upsert합니다.
 */

const SERVICE_KEY = process.env.PUBLIC_DATA_API_KEY ?? '';
const PAGE_SIZE = 1000;
const CATEGORY = '무더위쉼터';

interface ApiItem {
  buld_sn: string;
  num: number;
  cc_nm: string;
  cc_type: string;
  rn_adres: string;
  adres: string;
  tot_ar: string;
  use_num: string;
  hv_ef: string;
  hv_ac: string;
  rest_at: string;
  night_at: string;
  weekend_at: string;
  lodge_at: string;
  x: string;
  y: string;
}

async function fetchPage(pageNo: number): Promise<{ items: ApiItem[]; totalCount: number }> {
  const { data } = await axios.get('http://safemap.go.kr/openapi2/IF_0001', {
    params: {
      serviceKey: SERVICE_KEY,
      pageNo,
      numOfRows: PAGE_SIZE,
      returnType: 'json',
    },
  });

  if (data?.header?.resultCode !== '00') {
    throw new Error(`API 오류: ${data?.header?.resultMsg ?? '알 수 없는 오류'}`);
  }

  const rawItems = data?.body?.items?.item ?? [];
  const items: ApiItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];
  const totalCount = data?.body?.totalCount ?? 0;

  return { items, totalCount };
}

function blankToNull(v: string | undefined): string | null {
  if (v === undefined || v === null || v.trim() === '') return null;
  return v;
}

async function seed() {
  if (!SERVICE_KEY) {
    console.error('PUBLIC_DATA_API_KEY가 .env에 설정되어 있지 않습니다.');
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
      const x = parseFloat(row.x);
      const y = parseFloat(row.y);
      if (!x || !y) {
        skipped++;
        continue;
      }

      const { lat, lng } = convertToWGS84(x, y);
      if (!isInsideKorea(lat, lng)) {
        skipped++;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO shelters
             (ext_id, category, facility_type, name, address, road_address,
              total_area, capacity, has_fan, has_aircon,
              rest_available, night_available, weekend_available, lodge_available, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                   ST_MakePoint($15, $16)::geography)
           ON CONFLICT (ext_id, category) DO UPDATE SET
             facility_type = EXCLUDED.facility_type,
             name = EXCLUDED.name,
             address = EXCLUDED.address,
             road_address = EXCLUDED.road_address,
             total_area = EXCLUDED.total_area,
             capacity = EXCLUDED.capacity,
             has_fan = EXCLUDED.has_fan,
             has_aircon = EXCLUDED.has_aircon,
             rest_available = EXCLUDED.rest_available,
             night_available = EXCLUDED.night_available,
             weekend_available = EXCLUDED.weekend_available,
             lodge_available = EXCLUDED.lodge_available,
             location = EXCLUDED.location`,
          [
            row.buld_sn,
            CATEGORY,
            row.cc_type || null,
            row.cc_nm || null,
            row.adres === '-' ? null : row.adres,
            row.rn_adres || null,
            row.tot_ar ? parseFloat(row.tot_ar) : null,
            row.use_num ? parseInt(row.use_num, 10) : null,
            blankToNull(row.hv_ef),
            blankToNull(row.hv_ac),
            blankToNull(row.rest_at),
            blankToNull(row.night_at),
            blankToNull(row.weekend_at),
            blankToNull(row.lodge_at),
            lng,
            lat,
          ]
        );
        success++;
      } catch (err) {
        console.error(`저장 실패 (buld_sn=${row.buld_sn}):`, err);
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
