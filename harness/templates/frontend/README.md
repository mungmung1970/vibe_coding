# Frontend template

이미지 기준의 LLM Lab 화면을 React + Vite + Node.js 기반으로 재현한 템플릿입니다.

```sh
npm install
npm run dev       # React 개발 서버
npm run server    # Node API placeholder (:3000)
npm run build
```

## 구조

```text
src/
├── components/  재사용 UI 조각과 레이아웃
├── data/        목업, 메뉴, 권한 정책의 입력 데이터
├── features/    auth, admin, workbench 업무 기능
├── services/    인증·모델 API 어댑터
└── styles/      디자인 토큰과 컴포넌트 CSS
```

로그인 데모 계정은 `admin@example.com / admin`입니다. `src/services/authService.js`를 실제 Node API 호출로 교체하고, `server/index.js`에 세션·RBAC 검증을 추가한 뒤 운영에 사용해야 합니다.
