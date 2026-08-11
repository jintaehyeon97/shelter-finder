export interface ShadySegment {
  coordinates: { latitude: number; longitude: number }[];
  isShaded: boolean;
  source: 'building' | 'none';
  distance: number; // 미터
  time: number; // 초
}

export interface ShadeSummary {
  totalShadedTime: number; // 초
  totalExposedTime: number; // 초
  maxContinuousExposureSec: number;
  shadeRatio: number; // 0~1
}

export interface ShadyRoute {
  totalDistance: number;
  totalTime: number;
  path: { latitude: number; longitude: number }[];
  segments: ShadySegment[];
  shadeSummary: ShadeSummary;
  warning: string | null;
}
