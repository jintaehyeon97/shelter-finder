import { pool } from '../db';

const SQL = `
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS convenience_stores (
  id SERIAL PRIMARY KEY,
  objt_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(50),
  address VARCHAR(300),
  road_address VARCHAR(300),
  telno VARCHAR(20),
  ctprvn_cd VARCHAR(10),
  sgg_cd VARCHAR(10),
  emd_cd VARCHAR(10),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  data_yr INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_location ON convenience_stores USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_store_name ON convenience_stores USING GIN (to_tsvector('simple', name));

-- 카카오 로컬 API로 실존 여부를 대조 검증하기 위한 컬럼
-- verify_miss_count: 검증했는데 카카오에 없었던 횟수 (연속 2회 이상이면 지도에서 숨김)
ALTER TABLE convenience_stores ADD COLUMN IF NOT EXISTS verify_miss_count INT NOT NULL DEFAULT 0;
ALTER TABLE convenience_stores ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP;

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

CREATE TABLE IF NOT EXISTS parks (
  id SERIAL PRIMARY KEY,
  manage_no VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(200),
  park_type VARCHAR(50),          -- parkSe (근린공원, 어린이공원 등)
  address VARCHAR(300),           -- lnmadr
  road_address VARCHAR(300),      -- rdnmadr
  area NUMERIC,                   -- parkAr (㎡)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_park_location ON parks USING GIST(location);
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
