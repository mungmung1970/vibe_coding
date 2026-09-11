# TASK-002 PLAN

## Scope

요청받은 `DEMO_MSA_LLM_*` 설정으로 `gpt-oss-120b` 등록을 연결해 프론트 모델 선택 목록에 노출한다.

## Impacted files

- `models/gpt-oss-120b/model.json`: 엔드포인트와 API 키 환경변수 연결
- `var/secrets.env`: 로컬 실행 설정 보관
- `src/backend/app/services/secrets.py`: 사용자 정의 API 키 마스킹
- `src/backend/tests/test_providers.py`: 키 마스킹 회귀 검증

## Acceptance criteria

- 백엔드 모델 목록에 `gpt-oss-120b (LLM)`이 나타난다.
- 선택 후 요청 대상 모델은 `gpt-oss-120b`이고 요청 URL은 `http://10.10.20.20:8001/v1`이다.
- API 키 값은 모델 등록부나 로그에 노출되지 않는다.
- 기존 백엔드/프론트 검증이 통과한다.

## Risks and checks

- 내부망 주소는 현재 환경에서 실제 호출하지 않고 등록 및 가짜 서버 테스트로 검증한다.
- `DEMO_MSA_LLM_TIMEOUT=300`은 전달받은 실행 설정으로 보관한다.
