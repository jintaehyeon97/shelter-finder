export interface TransitLeg {
  mode: string; // WALK, BUS, SUBWAY 등
  sectionTime: number; // 초
  distance: number; // 미터
  routeName?: string;
  routeColor?: string; // 예: "0068B7" (# 없음)
  startName: string;
  endName: string;
  path: { latitude: number; longitude: number }[];
}

export interface TransitItinerary {
  totalTime: number; // 초
  totalFare: number; // 원
  transferCount: number;
  totalWalkTime: number;
  totalWalkDistance: number;
  totalDistance: number;
  legs: TransitLeg[];
}
