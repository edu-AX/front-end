# 톤앤매너 — 교사 인수인계 플랫폼 (프론트엔드, `edu-AX/front-end`)

부서 담당자가 바뀌어도 **작년 기록·전임자 메모·D-day 로드맵**을 이어받아 행사를 준비할 수 있게 하는 교사용 인수인계 플랫폼의 **화면**이에요.
해커톤 시연 범위에 맞춰 **고등학교 창의적 체험활동부 하나만** 구현했고, 다른 부서는 "준비 중"으로 두었어요.

## 두 저장소

| 저장소 | 역할 | 로컬 포트 |
|---|---|---|
| **[`edu-AX/front-end`](https://github.com/edu-AX/front-end)** (이 저장소) | 화면: 인수인계 받기, 작년 이맘때, 대시보드·캘린더, 행사 카드(작년 기록·전임자 메모·넘기기), 캐릭터 챗봇 창, 결과보고서 업로드 창 | 3000 |
| **[`edu-AX/back-end`](https://github.com/edu-AX/back-end)** | API(`/api/chat` 챗봇, `/api/upload/*` 업로드·마스킹, `/api/health`) + 도메인 로직·데이터 **원본** + Gemini 키 | 3001 |

```
[브라우저] front-end (3000)
   ├─ 화면 계산(D-day 역산·대시보드·인수인계 요약)은 브라우저에서 바로
   │     └─ lib/ 공유 파일 15개 = back-end 의 특정 커밋에서 동기화 (backend.lock.json)
   └─ fetch  ${NEXT_PUBLIC_API_BASE_URL}/api/chat · /api/upload/*
                 └─▶ back-end (3001) ─▶ Gemini   (CORS: back-end 의 ALLOWED_ORIGINS)
```

## 실행

```bash
# 1) 백엔드 (다른 폴더)
git clone https://github.com/edu-AX/back-end.git && cd back-end
npm install && cp .env.example .env.local   # GEMINI_API_KEY 또는 DEMO_MODE=true
npm run dev                                  # http://localhost:3001/api/health

# 2) 프론트 (이 폴더)
npm install && cp .env.example .env.local   # 기본값이면 수정 없이 OK
npm run dev                                  # http://localhost:3000/high/activities?reset=1
```

- 시연할 때는 `npm run build`를 하고 `npm start`로 띄우세요. 앱 내장 브라우저에서 `npm run dev`를 쓰면 HMR 연결 실패로 페이지가 계속 새로고침될 수 있어요.
- `?reset=1`을 붙이면 저장된 상태를 지우고 "인수인계 받기"부터 다시 시작해요.

## 백엔드 공유 코드 동기화

화면이 브라우저에서 바로 쓰는 타입·계산 로직·샘플 데이터는 **백엔드가 원본**이에요. 이 저장소에는 `backend.lock.json`에 적힌 백엔드 커밋의 파일이 그대로 들어 있어요.

```bash
npm run sync:check                 # 공유 파일이 lock 의 백엔드 커밋과 같은지 검사
npm run sync:backend               # lock 커밋으로 맞추기
npm run sync:backend -- --latest   # 백엔드 main 최신으로 올리고 lock 갱신
```

공유 파일(`backend.lock.json` → `files`)은 여기서 직접 고치지 마세요. 백엔드에서 고치고 push한 뒤 `--latest`로 가져와요.

## 환경변수 (`.env.local`)

| 이름 | 설명 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 백엔드 주소. 비우면 `http://localhost:3001` |
| `NEXT_PUBLIC_DEMO_TODAY` | 데모 기준일 `2027-03-11` (백엔드와 같은 값) |

프론트에는 API 키가 없어요.

## 배포 (Vercel 프로젝트 2개)

1. 백엔드 프로젝트를 먼저 배포해요(`GEMINI_API_KEY`, `DEMO_MODE`, `ALLOWED_ORIGINS=<프론트 주소>`).
2. 이 저장소를 배포할 때 `NEXT_PUBLIC_API_BASE_URL=<백엔드 주소>`를 넣어요.

## 문서

- [docs/프론트_전달사항.md](docs/프론트_전달사항.md): 백엔드 함수 사용법, 화면 규칙, 변경 기록
