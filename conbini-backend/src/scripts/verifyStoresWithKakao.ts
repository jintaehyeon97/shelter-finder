import axios from 'axios';
import dotenv from 'dotenv';
import { pool } from '../db';

dotenv.config();

/**
 * 사용법: npm run verify:stores
 *
 * DB의 모든 편의점 좌표를 카카오 로컬 API(카테고리 검색)로 대조해서,
 * 근처에 카카오맵에서도 편의점이 검색되는지 확인합니다.
 * - 검색됨 → verify_miss_count = 0 (계속 표시)
 * - 검색 안 됨 → verify_miss_count + 1 (2번 연속 실패하면 지도에서 숨김 처리)
 *
 * 시간이 꽤 걸려요 (5만여 건 기준 30분~1시간 정도 예상).
 * 중간에 멈춰도 다시 실행하면 이어서 진행되니 걱정 안 하셔도 돼요.
 */

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY ?? '';
const RADIUS_M = 150; // 좌표 오차 감안한 검색 반경
const CONCURRENCY = 8; // 동시 요청 개수
const BATCH_DELAY_MS = 150; // 배치 사이 텀 (카카오 요청 속도 제한 대비)

interface StoreRow {
  id: number;
  lat: number;
  lng: number;
}

type CheckResult = 'FOUND' | 'NOT_FOUND' | 'ERROR';

async function checkKakao(lat: number, lng: number): Promise<CheckResult> {
  try {
    const { data } = await axios.get('https://dapi.kakao.com/v2/local/search/category.json', {
      params: {
        category_group_code: 'CS2',
        x: String(lng),
        y: String(lat),
        radius: RADIUS_M,
        size: 1,
      },
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
      timeout: 5000,
    });
    return (data?.documents?.length ?? 0) > 0 ? 'FOUND' : 'NOT_FOUND';
  } catch (err: any) {
    // 실제 원인을 알 수 있도록 상세 로그 (너무 많이 찍히지 않게 상태코드만)
    console.warn(
      '카카오 요청 오류(스킵, 이번 회차는 판정 보류):',
      err.response?.status,
      JSON.stringify(err.response?.data ?? err.message)
    );
    return 'ERROR';
  }
}

async function processBatch(rows: StoreRow[]) {
  await Promise.all(
    rows.map(async (row) => {
      const result = await checkKakao(row.lat, row.lng);
      if (result === 'FOUND') {
        await pool.query(
          `UPDATE convenience_stores SET verify_miss_count = 0, last_verified_at = NOW() WHERE id = $1`,
          [row.id]
        );
      } else if (result === 'NOT_FOUND') {
        await pool.query(
          `UPDATE convenience_stores
             SET verify_miss_count = verify_miss_count + 1, last_verified_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
      }
      // ERROR인 경우 아무것도 하지 않고 그대로 둠 (오탐으로 인한 리셋/증가 방지)
    })
  );
}

async function run() {
  if (!KAKAO_REST_API_KEY) {
    console.error('KAKAO_REST_API_KEY가 .env에 설정되어 있지 않습니다.');
    process.exit(1);
  }

  const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM convenience_stores');
  const total = parseInt(countRows[0].count, 10);
  console.log(`총 ${total}건 검증 시작 (반경 ${RADIUS_M}m, 동시요청 ${CONCURRENCY}개)`);

  let processed = 0;
  const pageSize = 500;

  for (let offset = 0; offset < total; offset += pageSize) {
    const { rows } = await pool.query<StoreRow>(
      `SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM convenience_stores
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);
      await processBatch(chunk);
      processed += chunk.length;
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    console.log(`진행: ${processed}/${total}`);
  }

  const { rows: hiddenRows } = await pool.query(
    'SELECT COUNT(*) FROM convenience_stores WHERE verify_miss_count >= 2'
  );
  console.log(`\n검증 완료. 지도에서 숨겨진(2회 연속 미검색) 편의점: ${hiddenRows[0].count}건`);

  await pool.end();
}

run().catch((err) => {
  console.error('검증 실패:', err);
  process.exit(1);
});
