import { pool } from '../db';

const SQL = `
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS shelters (
  id SERIAL PRIMARY KEY,
  ext_id VARCHAR(30) NOT NULL,
  category VARCHAR(20) NOT NULL,              -- '무더위쉼터' / '한파쉼터'
  facility_type VARCHAR(50),                  -- cc_type
  name VARCHAR(200),                          -- cc_nm
  address VARCHAR(300),                       -- adres
  road_address VARCHAR(300),                  -- rn_adres
  total_area NUMERIC,                         -- tot_ar
  capacity INT,                               -- use_num
  has_fan VARCHAR(20),                        -- hv_ef (숫자 또는 '정보없음')
  has_aircon VARCHAR(20),                     -- hv_ac
  rest_available VARCHAR(1),                  -- rest_at
  night_available VARCHAR(1),                 -- night_at
  weekend_available VARCHAR(1),               -- weekend_at
  lodge_available VARCHAR(1),                 -- lodge_at
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ext_id, category)
);

CREATE INDEX IF NOT EXISTS idx_shelter_location ON shelters USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_shelter_category ON shelters(category);
`;

async function migrate() {
  console.log('마이그레이션 시작...');
  try {
    await pool.query(SQL);
    console.log('마이그레이션 완료: 테이블/인덱스 생성됨');
  } catch (err) {
    console.error('마이그레이션 실패:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
