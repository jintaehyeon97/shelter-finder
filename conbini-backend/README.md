# conbini-backend

편의점 재고 지도 앱의 백엔드 서버 (Node.js + Express + TypeScript + PostgreSQL/PostGIS)

## API 엔드포인트
| Method | Path | 설명 |
|---|---|---|
| GET | `/stores/nearby?lat=&lng=&radius=` | 반경 내 편의점 조회 |
| GET | `/stores/search?q=` | 상호명/주소 검색 |
| GET | `/stores/:id/stock` | 상품별 최신 재고 현황 |
| POST | `/stock-reports` | 재고 제보 등록 |
| GET | `/favorites?userId=` | 즐겨찾기 목록 |
| POST | `/favorites` | 즐겨찾기 추가 |
| DELETE | `/favorites` | 즐겨찾기 삭제 |

## 1. DB 준비하기

PostGIS(공간 데이터 확장 기능)가 있는 PostgreSQL이 필요해요. 로컬에 직접 설치하거나, 클라우드 무료 플랜을 쓰는 방법 중 편한 걸 고르세요.

### 옵션 A: Supabase (추천 — 설치 없이 바로 시작)
1. https://supabase.com 가입 후 새 프로젝트 생성 (무료 플랜으로 충분)
2. 프로젝트 대시보드 → **SQL Editor** → 아래 명령 실행해서 PostGIS 활성화
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. 프로젝트 설정(Settings) → Database → **Connection string** 복사
4. `.env`의 `DATABASE_URL`에 붙여넣기

### 옵션 B: 로컬 PostgreSQL 설치 (Windows)
1. https://www.postgresql.org/download/windows/ 에서 설치 (설치 시 비밀번호 설정)
2. **PostGIS**는 PostgreSQL 설치 마법사의 "Stack Builder"에서 추가로 설치 가능 (Spatial Extensions 카테고리)
3. pgAdmin이나 psql로 `conbini`라는 이름의 데이터베이스 생성
4. `.env`의 `DATABASE_URL`을 로컬 접속 정보로 수정

## 2. 환경변수 설정

```bash
copy .env.example .env
```
`.env` 파일을 열어 `DATABASE_URL`을 본인 DB 정보로 수정하세요.

## 3. 설치 및 마이그레이션

```bash
npm install
npm run migrate
```
`npm run migrate`는 PostGIS 확장 활성화 + 테이블(`convenience_stores`, `stock_reports`, `favorites`) + 공간 인덱스를 자동 생성합니다.

## 4. 편의점 데이터 넣기 (선택)

1. 공공데이터포털에서 받은 전국 편의점 CSV를 `backend/data/stores.csv` 로 저장
   (컬럼: `objt_id, fclty_nm, adres, rn_adres, telno, ctprvn_cd, sgg_cd, emd_cd, x, y, data_yr`)
2. 실행:
   ```bash
   npm run seed
   ```
   자동으로 좌표(EPSG:5179 → WGS84)를 변환하고 브랜드명을 파싱해서 DB에 저장합니다.

> OpenAPI로 직접 실시간 호출하는 방식으로 바꾸고 싶다면 `src/scripts/seed.ts`의 `readRows()` 함수만 axios 기반 API 호출로 교체하면 돼요. 이 부분은 인증키 발급받으신 후 같이 작업하면 좋을 것 같아요.

## 5. 서버 실행

```bash
npm run dev
```
`http://localhost:4000/health` 접속했을 때 `{"ok":true}`가 뜨면 정상 동작하는 거예요.

## 6. 앱(프론트엔드)에서 연결하기

`conbini-app/src/api/client.ts`의 `API_BASE_URL`을 본인 PC의 로컬 IP로 수정하세요.

```ts
export const API_BASE_URL = 'http://192.168.0.5:4000'; // 본인 PC IP로 변경
```

로컬 IP 확인: `ipconfig` (Windows) → "IPv4 주소" 확인

## 트러블슈팅
- **`ECONNREFUSED` 에러**: DB가 실행 중인지, `DATABASE_URL`이 정확한지 확인
- **`extension "postgis" does not exist`**: PostGIS가 설치/활성화 안 된 것. Supabase는 SQL Editor에서 `CREATE EXTENSION postgis;` 실행, 로컬은 Stack Builder로 PostGIS 추가 설치 필요
- **폰에서 API 호출이 안 될 때**: PC 방화벽에서 Node.js/포트 4000 허용 필요 (프론트엔드 트러블슈팅과 동일한 이슈)
