# TASK-007 · PLAN — 프론트엔드를 React + Vite로 이관

작성일: 2026-09-07
상태: 사용자 확정("프론트만 React")으로 즉시 실행

## 1. 배경

`harness/templates/frontend`와 `harness/docs/FRONTEND_STANDARD.md`가 작업 도중 **React + Vite + Node.js 기준으로 교체**되었다. 이 저장소의 프론트엔드는 교체 전 기준(의존성 없는 바닐라 ES 모듈)으로 만들어져 표준과 어긋나 있다.

백엔드는 vLLM 프로세스 관리·SSE 스트리밍·파라미터 검증·기록·채점을 담당하며 테스트 42건으로 검증돼 있다. 이번 범위는 **화면만** 옮기는 것이다.

## 2. 범위

포함
- `src/frontend`를 React 19 + Vite 7 구성으로 재작성
- 현재 화면 동작 **전부 보존**: 모델 선택·서빙 상태, JSON 스키마 기반 파라미터 패널, 스트리밍 답변, 사고 진행 표시, 저장 버튼, 이미지 첨부, 결과 조회(카드/크롬 탭/우클릭 삭제/숨김), 답변 비교(모범답변·심판 모델·순위)
- 하니스 표준 구조(`components` / `features` / `data` / `services` / `styles`) 적용
- 빌드 산출물(`dist`)을 파이썬 백엔드가 서빙하도록 경로 처리

제외
- 백엔드 재작성(파이썬 유지), Node API 도입
- 인증·권한 기능 추가(템플릿에는 있으나 이 저장소에는 백엔드 인증이 없다. 상단 배지는 지금처럼 `anonymous`)
- 화면 기능 추가·변경

## 3. 설계

| 항목 | 방침 |
| --- | --- |
| 상태 관리 | 커스텀 store 제거, React `useState`/`useReducer` + Context. 서빙·모델 등 공유 상태는 `WorkbenchContext` 하나로 |
| 스트리밍 | 델타를 ref에 누적하고 60ms 간격으로만 setState. 리렌더 폭주와 "완료 후 옛 스냅샷 덮어쓰기" 회귀를 함께 막는다 |
| 순수 모듈 | `utils/markdown.js`, `utils/format.js`는 그대로 재사용(테스트도 유지) |
| API | `services/api.js` 그대로. 컴포넌트에서 직접 fetch하지 않는다 |
| 스타일 | 기존 `styles/index.css` 유지(디자인 토큰·크롬 탭·얇은 슬라이더/스크롤바 전부 보존) |
| 서빙 | `npm run build` → `dist/`. 백엔드 `frontend_dir`이 `dist`가 있으면 그쪽을, 없으면 기존 경로를 서빙 |
| 개발 | `npm run dev`(5173)에서 `/api`를 8080으로 프록시 |

## 4. 영향 파일

신규: `package.json`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/components/*.jsx`, `src/features/workbench/*.jsx`, `src/state/WorkbenchContext.jsx`
유지: `src/services/api.js`, `src/utils/*.js`, `src/styles/index.css`, `src/data/defaults.js`
삭제: 바닐라 렌더러(`src/main.js`, `src/components/*.js`, `src/state/store.js`, `src/state/actions.js`)
백엔드: `app/config.py`(dist 경로 선택)만

## 5. 인수 조건

| # | 조건 | 확인 |
| --- | --- | --- |
| AC1 | 빌드 성공 후 백엔드가 React 화면을 서빙 | `npm run build` + 실제 접속 |
| AC2 | 모델 선택 → 서빙 → 파라미터 표시 | 실제 브라우저 |
| AC3 | 프롬프트 실행 스트리밍, 사고 진행 표시 | 실제 모델 응답 |
| AC4 | 저장 버튼으로만 기록, 입력 변경 시 답변 비움 | 실제 브라우저 |
| AC5 | 결과 조회: 카드/크롬 탭+닫기/우클릭 삭제/X 숨김 | 실제 브라우저 |
| AC6 | 답변 비교: 모범답변·심판 모델·순위표 | 실제 채점 호출 |
| AC7 | 접기/펼치기, 유형 필터, 사용자 배지, 스크롤 분리 | 실제 브라우저 |
| AC8 | 백엔드 42건, 프론트 단위 테스트 유지 | 테스트 실행 |

## 6. 위험

| 위험 | 대응 |
| --- | --- |
| 스트리밍 리렌더 성능/경쟁 조건 재발 | ref 누적 + 스로틀 커밋, 완료 시 최종 상태로 한 번 더 커밋 |
| 마크다운 HTML 삽입 | `markdown.js`가 이스케이프 후 생성하므로 `dangerouslySetInnerHTML` 사용 가능. 이스케이프 테스트 유지 |
| 빌드 산출물 경로 혼동 | `dist` 존재 여부로 자동 선택하고 README에 명시 |
| npm 의존성 추가 | react/react-dom/vite만. 백엔드는 여전히 무의존성 |
