# Backend template

Python 표준 라이브러리 기반의 독립형 backend 시작 템플릿입니다. 현재
`projects/model_test/src/backend`의 구조와 실행 흐름을 일반화했습니다.

## 구조

```text
backend/
├── app/
│   ├── api/          # API route와 입력 검증
│   ├── core/         # HTTP, 응답, 공통 오류
│   ├── data/         # 버전 관리되는 정적 데이터
│   └── services/     # 도메인 로직·외부 연동 경계
├── tests/            # 프로젝트에서 추가하는 테스트
└── run.sh            # python3 -m app.main
```

기본 템플릿은 모델 목록·서빙·추론·실행 이력·SSE 응답을 포함합니다. 다른
도메인에서는 `services`의 기능을 교체하고 `api/routes.py`의 계약만
유지하면 됩니다.

## 실행

```sh
./run.sh
```

환경 변수는 `APP_*` 접두사를 사용합니다. 비밀값은 저장소 밖의
`var/secrets.env`에 두고, 프로젝트별로 필요한 공용 인프라 값만 `.env`로
주입합니다.
