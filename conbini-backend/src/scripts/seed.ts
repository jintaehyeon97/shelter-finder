import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { pool } from '../db';
import { convertToWGS84, isInsideKorea } from '../utils/coords';
import { extractBrand } from '../utils/brand';

/**
 * 사용법:
 *   1) 공공데이터포털에서 받은 CSV를 backend/data/stores.csv 로 저장
 *      (컬럼: objt_id, fclty_ty, fclty_cd, fclty_nm, adres, rn_adres, telno,
 *             ctprvn_cd, sgg_cd, emd_cd, x, y, data_yr)
 *   2) npm run seed
 *
 * OpenAPI로 직접 받아오는 방식으로 바꾸려면 이 파일의 readRows() 부분만
 * axios로 API 호출 + 페이징 로직으로 교체하면 됩니다.
 */

interface RawRow {
  objt_id: string;
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

function readRows(): RawRow[] {
  const csvPath = path.join(__dirname, '../../data/stores.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    console.error('공공데이터포털에서 받은 CSV를 backend/data/stores.csv 로 저장해주세요.');
    process.exit(1);
  }
  const content = fs.readFileSync(csvPath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

async function seed() {
  const rows = readRows();
  console.log(`총 ${rows.length}건 처리 시작...`);

  let success = 0;
  let skipped = 0;

  for (const row of rows) {
    const x = parseFloat(row.x);
    const y = parseFloat(row.y);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      skipped++;
      continue;
    }

    const { lat, lng } = convertToWGS84(x, y);
    if (!isInsideKorea(lat, lng)) {
      // 좌표 변환이 잘못됐을 가능성 -> 건너뛰고 로그만 남김
      console.warn(`좌표 범위 이상 (objt_id=${row.objt_id}): lat=${lat}, lng=${lng}`);
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
          row.objt_id,
          row.fclty_nm,
          brand,
          row.adres,
          row.rn_adres,
          row.telno || null,
          row.ctprvn_cd,
          row.sgg_cd,
          row.emd_cd,
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

  console.log(`완료: 성공 ${success}건, 건너뜀 ${skipped}건`);
  await pool.end();
}

seed();
