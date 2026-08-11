import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY ?? '';
const CONVENIENCE_STORE_CATEGORY = 'CS2';

export interface KakaoStore {
  id: string;
  name: string;
  brand: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  distance?: number;
}

function extractBrand(categoryName: string, placeName: string): string {
  // 카카오 category_name 예: "가정,생활 > 편의점 > 이마트24"
  const parts = categoryName.split('>').map((p) => p.trim());
  const last = parts[parts.length - 1];
  if (last && last !== '편의점') return last;

  // 카테고리명으로 안 잡히면 상호명에서 유추
  if (placeName.includes('GS25') || placeName.includes('지에스25')) return 'GS25';
  if (placeName.includes('CU') || placeName.includes('씨유')) return 'CU';
  if (placeName.includes('세븐일레븐')) return '세븐일레븐';
  if (placeName.includes('이마트24')) return '이마트24';
  return '기타';
}

function mapDocument(doc: any): KakaoStore {
  return {
    id: doc.id,
    name: doc.place_name,
    brand: extractBrand(doc.category_name ?? '', doc.place_name ?? ''),
    address: doc.address_name,
    roadAddress: doc.road_address_name,
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    distance: doc.distance ? parseFloat(doc.distance) : undefined,
  };
}

/**
 * 좌표 기준 반경 내 편의점을 카카오 로컬 API로 실시간 조회합니다.
 * (카테고리 검색, 최대 3페이지=45건까지)
 */
export async function fetchNearbyConvenienceStores(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<KakaoStore[]> {
  const results: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const { data } = await axios.get('https://dapi.kakao.com/v2/local/search/category.json', {
      params: {
        category_group_code: CONVENIENCE_STORE_CATEGORY,
        x: String(lng),
        y: String(lat),
        radius: Math.min(radiusMeters, 20000),
        sort: 'distance',
        page,
        size: 15,
      },
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      timeout: 5000,
    });
    results.push(...(data?.documents ?? []));
    if (data?.meta?.is_end) break;
  }
  return results.map(mapDocument);
}

/**
 * 상호명/지역명으로 편의점을 카카오 로컬 API로 실시간 검색합니다.
 * (키워드 검색, 최대 3페이지=45건까지)
 */
export async function searchConvenienceStoresByKeyword(keyword: string): Promise<KakaoStore[]> {
  const results: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const { data } = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: keyword,
        category_group_code: CONVENIENCE_STORE_CATEGORY,
        page,
        size: 15,
      },
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      timeout: 5000,
    });
    results.push(...(data?.documents ?? []));
    if (data?.meta?.is_end) break;
  }
  return results.map(mapDocument);
}
