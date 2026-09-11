# Frontend Standard

## 기본 템플릿

`harness/templates/frontend`는 이미지 기준의 LLM Lab UI를 React + Vite + Node.js 기준으로 제공한다.

- 색상: `#191a1f` 사이드바, `#d65d39` 포인트, `#8d402b` 사이드바 테두리, 흰색 패널, 밝은 회색 배경
- 레이아웃: 44px 상단바, 좁은 제어 사이드바, 오렌지 패널 헤더, 탭 네비게이션
- 버튼: 기본 `.btn`, 강조 `.btn-primary`, 위험 `.btn-danger`를 우선 사용

## 소스 경계

`components`는 렌더링, `features`는 업무 기능, `data`는 목업/응답 모양, `services`는 API 연동, `styles`는 시각 토큰, `utils`는 표시용 순수 함수만 둔다. 컴포넌트에서 직접 API를 호출하지 않는다.

실제 모델 워크벤치는 `services/api.js`에서 JSON과 SSE를 처리하고, context/state에서 모델·provider·modality·파라미터·스트리밍·취소·저장·비교 상태를 관리한다. 문서 첨부와 STT/TTS/VIDEO는 백엔드 계약이 있는 프로젝트에서만 함께 활성화하며, local serving 상태와 provider 호출을 같은 상태로 뭉개지 않는다.

기본 인증/권한 예시는 `features/auth`에 있으며 `admin`, `operator`, `viewer` 역할과 메뉴별 `read/manage` 권한을 제공한다. 프론트 권한은 UX 제어용이고, 실제 권한 검증은 Node API에서 세션과 함께 다시 수행해야 한다.

## 화면 규칙

실사용에서 검증된 규칙이며 템플릿에 이미 구현되어 있다. 되돌릴 때는 근거를 남긴다.

- 상단 우측에는 **로그인 ID**를 표시한다(로그인 전 `anonymous`).
- 상단 탭은 **모서리만 둥근 사각형**이고 탭·명령 버튼은 **가로 폭이 같다**.
- 좌측 상자는 모두 **접기/펼치기**가 가능하다.
- **사이드바와 본문이 각자 스크롤**한다. 창 전체 스크롤이 좌측 메뉴를 끌고 가지 않는다.
- 슬라이더는 3px, 스크롤바는 7px로 얇게 유지한다.
- 결과 탭은 **크롬 탭 모양이며 ×로 닫는다**.
- 카드의 **×는 숨김**이고 **삭제는 우클릭 메뉴**에서만 한다.
- 답변은 **저장 버튼을 눌렀을 때만** 저장한다.
- 입력이 바뀌면 **이전 답변을 비운다**.
- 모델명에 **(LLM)/(VLM)**을 표기하고 유형으로 필터한다.
- 답변 비교는 **모범답변과 심판 모델**을 받고 **순위표**를 보여준다. 순위는 점수로 화면에서 계산한다.

## 빌드

`@vitejs/plugin-react`가 없으면 JSX가 자동 런타임으로 변환되지 않아 빌드 산출물이 `React is not defined`로 죽는다. `vite.config.js`의 `plugins: [react()]`를 유지한다.


`harness/templates/frontend/.agents/skills/frontend-template/SKILL.md`는 이 규칙을 Codex가 이후 작업에서 자동 참조할 수 있도록 제공한다.
