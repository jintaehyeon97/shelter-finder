export interface WalkingRoute {
  totalDistance: number; // 미터
  totalTime: number; // 초
  path: { latitude: number; longitude: number }[];
}
