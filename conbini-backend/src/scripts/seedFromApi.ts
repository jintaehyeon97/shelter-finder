import axios from 'axios';
import dotenv from 'dotenv';
import { pool } from '../db';
import { convertToWGS84, isInsideKorea } from '../utils/coords';
import { extractBrand } from '../utils/brand';

dotenv.config();

/**
 * 사용법: npm run seed:api
 *
 * safemap.go.kr의 IF_0039(공통시설물) API를 페이징 호출해서
 * 전국 편의점 데이터를 모두 받아와 DB에 upsert합니다.
 */

const SERVICE_KEY = process.env.PUBLIC_DATA_API_KEY ?? '';
const PAGE_SIZE = 1000;

interface ApiItem {
  objt_id: number;
  fclty_ty: string;
  fclty_cd: string;
  fclty_nm: string;
  adres: string;
  rn_adres: string;
  telno: string;
  ctprvn_cd: string;
  sgg_cd: string;
  emd_cd: string;
  x: string;
  y: string;
  data_yr: string;
}

async function fetchPage(pageNo: number): Promise<{ items: ApiItem[]; totalCount: number }> {
  const { data } = await axios.get('http://safemap.go.kr/openapi2/IF_0039', {
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

      const brand = extractBrand(row.fclty_nm);

      try {
        await pool.query(
          `INSERT INTO convenience_stores
             (objt_id, name, brand, address, road_address, telno, ctprvn_cd, sgg_cd, emd_cd, location, data_yr)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_MakePoint($10, $11)::geography, $12)
           ON CONFLICT (objt_id) DO UPDATE SET
             name = EXCLUDED.name,
             brand = EXCLUDED.brand,
             address = EXCLUDED.address,
             road_address = EXCLUDED.road_address,
             location = EXCLUDED.location,
             data_yr = EXCLUDED.data_yr`,
          [
            String(row.objt_id),
            row.fclty_nm,
            brand,
            row.adres,
            row.rn_adres,
            row.telno || null,
            row.ctprvn_cd || null,
            row.sgg_cd || null,
            row.emd_cd || null,
            lng,
            lat,
            parseInt(row.data_yr, 10) || null,
          ]
        );
        success++;
      } catch (err) {
        console.error(`저장 실패 (objt_id=${row.objt_id}):`, err);
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
    // API에 부담 안 주려고 살짝 텀 주기
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n전체 완료: 성공 ${success}건, 건너뜀 ${skipped}건`);
  await pool.end();
}

seed().catch((err) => {
  console.error('시딩 실패:', err);
  process.exit(1);
});
