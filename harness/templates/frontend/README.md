# Frontend template

`projects/model_test/src/frontend`에서 실사용하며 다듬은 화면 규칙을 React + Vite + Node.js 기준으로 일반화한 템플릿입니다. `doc/images`의 색상과 밀도를 기준으로 스타일 토큰을 구성했습니다.

```sh
npm install
npm run dev       # React 개발 서버 (5173, /api는 3000으로 프록시)
npm run server    # Node API placeholder (:3000)
npm run build     # dist/ 생성
sh tests/smoke.sh # 구성 확인 + 빌드
```

## 구조

```text
src/
├── components/  재사용 UI (Layout, SideSection, RunCard, CompareDialog, Button)
├── data/        목업, 메뉴, 권한 정책의 입력 데이터
├── features/    auth, admin, workbench 업무 기능
├── services/    인증·모델 API 어댑터
├── styles/      디자인 토큰과 컴포넌트 CSS
└── utils/       표시용 순수 함수 (날짜·시간·순위 계산)
```

## 이 템플릿이 이미 담고 있는 화면 규칙

실제 운영에서 문제가 됐던 것들을 미리 반영해 두었습니다.

| 규칙 | 이유 |
| --- | --- |
| 상단 우측에 **로그인 ID** 배지 | 누구로 접속했는지가 가장 먼저 필요한 정보다 |
| 상단 탭은 **모서리만 둥근 사각형 + 동일 폭**, 명령 버튼도 **동일 폭**(116px) | 폭이 제각각이면 조작 대상이 흔들려 보인다 |
| 좌측 상자 전부 **접기/펼치기**(`SideSection`) | 파라미터가 늘어나면 사이드바가 길어진다 |
| **사이드바와 본문이 각자 스크롤** | 창 스크롤이 좌측 메뉴까지 끌고 가면 조작이 불편하다 |
| **얇은 슬라이더(3px)·스크롤바(7px)** | 기본 스타일은 이 화면 밀도에 비해 두껍다 |
| 결과는 **크롬 스타일 탭 + 닫기(×)** | 여러 결과를 오가며 비교한다 |
| 카드의 **X는 숨김, 삭제는 우클릭 메뉴** | X로 실수로 지우는 사고를 막는다 |
| 답변은 **저장 버튼을 눌러야 저장** | 모든 실행을 자동 저장하면 기록이 잡음으로 찬다 |
| 입력이 바뀌면 **답변창을 비운다** | 이전 답이 새 질문의 결과처럼 보인다 |
| 모델명에 **(LLM)/(VLM)** 표기와 유형 필터 | 이미지 입력 가능 여부를 고를 때 바로 안다 |
| 답변 비교에 **모범답변·심판 모델·순위표** | 비교는 나란히 보기만으로는 부족하다 |

순위는 심판이 준 **점수를 화면에서 정렬해** 계산합니다(`utils/format.js`). 모델이 스스로 매긴 순서를 그대로 쓰면 점수와 어긋나는 경우가 있습니다.

## 실제 API로 교체하기

`src/services/modelService.js`와 `authService.js`가 유일한 연동 지점입니다. 각 함수에 교체할 엔드포인트를 주석으로 적어 두었습니다. 목업 데이터는 `src/data/sample.js`에 모여 있어 통째로 지우면 됩니다.

로그인 데모 계정은 `admin@example.com / admin`입니다. 프론트의 메뉴 권한은 UX 제어일 뿐이므로, `server/index.js`에 세션과 RBAC 검증을 반드시 다시 구현해야 합니다.

**주의**: `@vitejs/plugin-react`가 없으면 JSX가 자동 런타임으로 변환되지 않아 빌드 산출물이 `React is not defined`로 죽습니다. `vite.config.js`의 `plugins: [react()]`를 지우지 마세요. 스모크 테스트가 이 조건을 확인합니다.
