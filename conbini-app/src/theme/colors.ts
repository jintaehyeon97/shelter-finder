/**
 * 앱 전체 색상 체계
 *
 * 브랜드 컬러: 딥 인디고 — 신뢰감 있고 차별화된 메인 컬러 (안전/주요 액션)
 * 위험/경고 컬러: 코랄 — 노출·주의를 상징
 * 이 두 색이 앱 전체에서 "안전(브랜드컬러) vs 위험(코랄)"이라는 하나의 규칙으로 일관되게 쓰입니다.
 */
export const Colors = {
  // 브랜드 컬러 — 딥 인디고
  primary: '#5B4FE3',
  primaryDark: '#4638B3',
  primaryLight: '#EEECFC',

  // 위험/경고 컬러 (직사광선 노출, 경고 문구 등)
  danger: '#F2543D',
  dangerLight: '#FDEAE6',

  // 편의점 마커 전용 (쉼터=브랜드컬러와 구분되는 중립적 정보색)
  store: '#4C6FFF',

  // 중립 색상
  neutral: '#9AA0A6',
  border: '#E5E7EB',
  backgroundSubtle: '#F7F8FA',
  background: '#FFFFFF',

  // 텍스트
  textPrimary: '#1A1D1F',
  textSecondary: '#6B7280',
  textOnPrimary: '#FFFFFF',
};
