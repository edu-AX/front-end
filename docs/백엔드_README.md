# 교사 인수인계 플랫폼 (공모전 데모)

창의적 체험활동부의 행사 업무를 작년 기록과 올해 기준으로 묶어서, 올해 담당자에게 캘린더·대시보드·캐릭터 챗봇으로 이어주는 플랫폼이에요.

- **처음 설정하기** → [docs/설정_가이드.md](docs/설정_가이드.md)
- **프론트 담당이 볼 문서** → [docs/프론트_전달사항.md](docs/프론트_전달사항.md)

```bash
npm install
npm test        # 계산·마스킹·챗봇 규칙 테스트
npm run dev     # http://localhost:3000/api/health
```

| 경로 | 내용 |
|---|---|
| `data/` | 샘플 데이터 (가상 학교 "한빛고등학교", 인천교육청 소속으로 가정) |
| `lib/` | 공통 타입, D-day 역산, 대시보드·캘린더 계산, 마스킹, 챗봇 로직 |
| `app/api/chat` | 챗봇 — 등록된 자료 안에서만 답하고 출처 칩을 붙임, `DEMO_MODE` 지원 |
| `app/api/upload/*` | 결과보고서 → 마스킹 미리보기 → 행사 카드 초안 (P1) |
| `app/api/health` | 배포 확인용 상태 |
| `tests/` | vitest 테스트 |

---
> 이 폴더(`front-end`)에는 `back-end` 저장소의 `lib/`, `data/`(events·templates·guidelines·changes), `app/api/`, `tests/`가 복사돼 있어요.
> 백엔드가 바뀌면 같은 파일을 다시 복사해야 해요. 화면 전용 확장 데이터(예산·장소·진로·담당 이력)는 `lib/ext.ts`, `data/ext-events.json` 등에 따로 있어요.
