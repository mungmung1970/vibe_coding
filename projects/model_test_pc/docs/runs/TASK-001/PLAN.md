# TASK-001 · PLAN — model_test_pc 신규 구성

작성일: 2026-09-07
상태: 사용자 요청으로 즉시 실행

## 1. 목적

`projects/model_test`와 같은 화면·기능을 제공하되, **로컬 vLLM 서빙을 전혀 하지 않고 API 호출만** 하는 별도 프로젝트를 만든다. GPU가 없는 PC에서도 그대로 실행할 수 있어야 한다.

기존 `projects/model_test`는 **수정하지 않는다.**

## 2. 사용할 모델

| 모델 | 방식 | 비고 |
| --- | --- | --- |
| `gpt-oss-120b` | 사내 엔드포인트(OpenAI 호환) | 주소는 설정으로 주입. 이 GPU 서버에서는 접속되지 않아 실호출 검증 불가 |
| OpenAI (GPT) | 외부 API | 키는 저장소 밖 `var/secrets.env` |
| Anthropic (Claude) | 외부 API | 위와 동일 |

## 3. 제외할 것 (기존 대비)

- vLLM 설치·프로세스 기동/중단, `.venv-vllm`
- 서빙 상태 기계(`serving_manager.py`), 엔진 로그 tail, 기동 대기 타임아웃
- `/api/v1/serving*` 엔드포인트와 화면의 서빙 시작·중단·로그 UI
- 로컬 가중치 스캔(`has_weights`, `hf_id`, `engine_args`, HF `config.json` 판독)

모델은 **항상 사용 가능**하므로 "선택 = 즉시 사용"이 된다.

## 4. 유지할 것

파라미터 카탈로그(JSON 단일 정의·공급자별 노출), SSE 스트리밍, 사고 과정 분리·진행 표시, 저장 버튼, 실행 기록 조회·숨김·삭제, 크롬 탭 보기, 답변 비교(모범답변·심판 모델·순위), 이미지 입력(VLM), 얇은 슬라이더/스크롤바, 로그인 ID 배지.

## 5. 구성

```text
projects/model_test_pc/
├── src/backend/     harness/templates/backend 기반, 서빙 제거 + providers 추가
├── src/frontend/    model_test의 React 화면에서 서빙 UI 제거
├── models/          엔드포인트·외부 API 모델 등록부(JSON)
├── var/secrets.env  API 키 (저장소 제외)
└── docs/            SOT·SPEC·ADR·테스트 전략·작업 기록
```

백엔드 서비스는 `providers.py`(OpenAI 호환 / Anthropic 어댑터), `model_registry.py`(엔드포인트 등록부), `parameter_catalog.py`, `inference.py`, `history.py`, `judge.py`, `secrets.py`로 줄인다.

## 6. 인수 조건

| # | 조건 | 확인 |
| --- | --- | --- |
| AC1 | vLLM·서빙 관련 코드가 하나도 남지 않음 | 소스 검색 |
| AC2 | 모델 목록이 엔드포인트/외부 API로만 구성 | `/api/v1/models` |
| AC3 | 외부 API(GPT·Claude)로 실제 생성 성공 | 실호출 |
| AC4 | 사내 엔드포인트 모델은 설정만으로 전환 가능하며, 접속 불가 시 명확한 오류 | 오류 메시지 확인 |
| AC5 | 화면에 서빙 관련 UI가 없고 나머지 기능은 동일 | 실제 브라우저 |
| AC6 | 백엔드·프론트 테스트 통과 | 테스트 실행 |
| AC7 | 기존 `projects/model_test`는 변경 없음 | git 상태 |

## 7. 열린 사항

- **사내 gpt-oss-120b 엔드포인트 주소**를 아직 모른다. `APP_GPTOSS_BASE_URL` 환경변수와 `models/gpt-oss-120b/model.json`의 `base_url`로 주입하도록 만들고, 실제 주소는 확인되는 대로 채운다.
- 그 엔드포인트가 API 키를 요구하는지 여부도 미확인. 키가 필요하면 `api_key_env`만 지정하면 되도록 설계한다.
