// 백엔드(edu-AX/back-end) API 주소. 챗봇·결과보고서 업로드는 모두 백엔드 서버가 처리한다.
// 로컬: 백엔드를 npm run dev (포트 3001) 로 띄우면 기본값 그대로 동작.
// 배포: NEXT_PUBLIC_API_BASE_URL 에 백엔드 배포 주소를 넣는다 (예: https://edu-ax-back.vercel.app)
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

export const apiUrl = (path: `/api/${string}`) => `${API_BASE}${path}`;
