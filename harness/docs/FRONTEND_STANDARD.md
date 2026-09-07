# Frontend Standard

## 기본 템플릿

`harness/templates/frontend`는 이미지 기준의 LLM Lab UI를 React + Vite + Node.js 기준으로 제공한다.

- 색상: `#191a1f` 사이드바, `#d65d39` 포인트, `#8d402b` 사이드바 테두리, 흰색 패널, 밝은 회색 배경
- 레이아웃: 44px 상단바, 좁은 제어 사이드바, 오렌지 패널 헤더, 탭 네비게이션
- 버튼: 기본 `.btn`, 강조 `.btn-primary`, 위험 `.btn-danger`를 우선 사용

## 소스 경계

`components`는 렌더링, `features`는 업무 기능, `data`는 목업/응답 모양, `services`는 API 연동, `styles`는 시각 토큰만 둔다. 컴포넌트에서 직접 API를 호출하지 않는다.

기본 인증/권한 예시는 `features/auth`에 있으며 `admin`, `operator`, `viewer` 역할과 메뉴별 `read/manage` 권한을 제공한다. 프론트 권한은 UX 제어용이고, 실제 권한 검증은 Node API에서 세션과 함께 다시 수행해야 한다.

`harness/templates/frontend/.agents/skills/frontend-template/SKILL.md`는 이 규칙을 Codex가 이후 작업에서 자동 참조할 수 있도록 제공한다.
