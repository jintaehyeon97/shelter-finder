# 편의점 재고 지도 앱 (conbini-app)

전국 편의점 지도 + 실시간 재고 제보 서비스 (React Native + Expo)

## 핵심 기능
- 전국 편의점 지도 (지도 화면, `src/screens/MapScreen.tsx`)
- 편의점 검색 (`src/screens/SearchScreen.tsx`)
- 반경 내 편의점 조회 (`fetchNearbyStores`, 백엔드 PostGIS `ST_DWithin` 사용 예정)
- 사용자 재고 제보 (`src/screens/ReportScreen.tsx`)
- 상품별 재고 현황
- 즐겨찾기 (`src/screens/FavoritesScreen.tsx`)
- 최근 제보 시간 표시 (`StockItem.reportedAt`)

## 폴더 구조
```
conbini-app/
├── App.tsx                  # 앱 엔트리, 네비게이션 컨테이너
├── app.json                 # Expo 설정 (권한, 아이콘 등)
├── src/
│   ├── navigation/           # 화면 라우팅
│   ├── screens/               # 지도/검색/즐겨찾기/제보 화면
│   ├── api/                   # 백엔드 API 클라이언트
│   ├── hooks/                 # 커스텀 훅 (위치 등)
│   └── types/                  # 공용 타입 정의
└── assets/                     # 아이콘, 스플래시 이미지
```

## 시작하기 (본인 폰 테스트)

### 1. 의존성 설치
```bash
cd conbini-app
npm install
```

### 2. 폰에 Expo Go 앱 설치
- iOS: App Store에서 "Expo Go" 검색
- Android: Play Store에서 "Expo Go" 검색

### 3. 개발 서버 실행
```bash
npx expo start
```
터미널에 뜨는 QR코드를 폰 카메라(iOS) 또는 Expo Go 앱(Android)으로 스캔하면 앱이 실행됩니다.

> ⚠️ PC와 폰이 **같은 Wi-Fi**에 연결되어 있어야 합니다.

### 4. 백엔드 연결
`src/api/client.ts`의 `API_BASE_URL`을 본인 PC의 로컬 IP 주소로 수정하세요.

로컬 IP 확인 방법:
- Mac/Linux: `ifconfig | grep inet`
- Windows: `ipconfig`

```ts
export const API_BASE_URL = 'http://192.168.0.5:4000'; // 본인 IP로 변경
```

같은 Wi-Fi가 아니거나 외부에서도 테스트하고 싶다면 [ngrok](https://ngrok.com)으로 백엔드를 터널링하거나, Railway/Render 같은 곳에 배포한 URL을 사용하세요.

## 지도 SDK 관련 참고
`react-native-maps`는 기본적으로 iOS는 Apple Maps, Android는 Google Maps를 사용합니다. Android에서 지도가 안 뜨면 `app.json`의 `android.config.googleMaps.apiKey`에 Google Maps API 키를 발급받아 채워 넣어야 합니다.

## TODO
- [ ] 백엔드 서버 구축 (Node.js + Express + PostgreSQL/PostGIS)
- [ ] 공공데이터포털 전국 편의점 데이터 시딩 (좌표계 EPSG:5179 → WGS84 변환 필요)
- [ ] 로그인/회원가입 (재고 제보, 즐겨찾기용)
- [ ] 즐겨찾기 로컬(AsyncStorage) → 서버 동기화
- [ ] 상품별 재고 현황 UI
