export interface ConvenienceStore {
  id: string;
  name: string;
  brand: string; // GS25, CU, 세븐일레븐, 이마트24 등
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  distance?: number; // 미터 단위, 반경 검색 시 채워짐
}
