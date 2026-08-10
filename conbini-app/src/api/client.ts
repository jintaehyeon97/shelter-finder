import axios from 'axios';

// 폰 실기기 테스트 시 'localhost'는 폰 자신을 가리키므로 사용 불가합니다.
// 1) 같은 Wi-Fi에서: PC의 로컬 IP (예: 192.168.0.5) 사용
// 2) 외부에서도 접속하려면: ngrok 등으로 터널링한 주소 사용
// 3) 배포된 백엔드가 있다면 해당 URL 사용
export const API_BASE_URL = 'http://192.168.0.5:4000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
});

export default apiClient;
