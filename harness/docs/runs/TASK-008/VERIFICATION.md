# TASK-008 · VERIFICATION

검증일: 2026-09-07
방법: `npm run build` 후 산출물을 정적 서버에 올리고 실제 Chrome을 CDP로 실시간 구동

## 요구사항 결과

| # | 요구 | 결과 | 근거 |
| --- | --- | --- | --- |
| R1 | 상단 우측 로그인 ID | **통과** | `●admin@example.com` + 로그아웃 링크 |
| R2 | 명령 버튼 폭 통일 | **통과** | 116, 116, 116 |
| R3 | 탭 사각형+둥근 모서리, 동일 폭 | **통과** | radius 6px, 폭 132·132·132 |
| R4 | 좌측 상자 접기/펼치기 | **통과** | 토글 3개, 클릭 시 `is-collapsed` |
| R5 | 얇은 슬라이더 | **통과** | 높이 3px |
| R6 | 사이드바/본문 독립 스크롤 | **통과** | 문서 스크롤 없음 |
| R7 | 크롬 탭 + 닫기 | **통과** | radius 9px, 비활성 `rgb(236,238,240)`, 닫기 2→1 |
| R8 | X는 숨김, 우클릭 삭제 | **통과** | 카드 3→2(기록 유지), 우클릭 메뉴 `삭제` |
| R9 | 저장 버튼 | **통과** | 실행 후 활성 → 클릭 시 `저장됨` |
| R10 | 입력 변경 시 답변 비움 | **통과** | 안내 문구로 복귀 |
| R11 | LLM/VLM 표기·필터 | **통과** | `gpt-oss-120b (LLM) / Qwen3-VL-27B (VLM) / …`, 유형 필터 동작 |
| R12 | 모범답변·심판 모델·순위 | **통과** | 순위표 `1위 openai-chat-latest / 2위 qwen3-vl-27b` |
| AC1 | 빌드 성공 | **통과** | 39개 모듈 → `dist/` |
| AC3 | 로그인 화면 동작 | **통과** | 로그인 카드 표시 → 로그인 후 작업 화면 진입 |
| AC4 | 스모크 통과 | **통과** | `react/node frontend template smoke test: ok (build 포함)` |
| AC5 | 표준 문서 갱신 | **통과** | FRONTEND_STANDARD·SKILL·README에 화면 규칙 12개 명시 |

## 함께 고친 템플릿 결함

**빌드 산출물이 실행되지 않았다.** `package.json`에 `@vitejs/plugin-react`가 없고 `vite.config.js`에 플러그인 설정도 없어, JSX가 클래식 런타임으로 변환되면서 브라우저에서 다음으로 죽었다.

```
Uncaught ReferenceError: React is not defined
```

기존 템플릿 파일도 모두 JSX였으므로 **보완 전부터 있던 결함**이다. 플러그인을 추가해 해결했고, 스모크 테스트가 `@vitejs/plugin-react` 존재와 `plugins: [react()]` 설정을 확인하도록 했다.

## 추가·변경 파일

신규: `components/SideSection.jsx`, `components/RunCard.jsx`, `components/CompareDialog.jsx`, `utils/format.js`
변경: `components/Layout.jsx`, `features/workbench/PromptPage.jsx`, `features/workbench/ComparePage.jsx`, `data/sample.js`, `services/modelService.js`, `styles/index.css`, `package.json`, `vite.config.js`, `tests/smoke.sh`, `README.md`, `.agents/skills/frontend-template/SKILL.md`, `docs/FRONTEND_STANDARD.md`

목업(모델 목록·저장된 실행·심판 후보)은 `data/sample.js`에 모아 두어 실제 API 연동 시 통째로 제거할 수 있다.

## 남은 사항

- 템플릿의 `server/index.js`는 여전히 `/api/health`만 있는 자리표시자다. 저장·비교·채점 엔드포인트는 프로젝트에서 구현해야 한다.
- 스트리밍(SSE)은 템플릿에 넣지 않았다. 목업 서비스로는 의미가 없고, 실제 구현은 프로젝트의 백엔드 형태에 따라 달라진다.
- 검증자가 구현자와 동일하다.
