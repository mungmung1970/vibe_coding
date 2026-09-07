# TASK-005 · EXECUTION

실행일: 2026-09-07
계획: docs/runs/TASK-005/PLAN.md

## 비밀정보

사용자 지시로 제공된 키를 그대로 사용한다. 다만 저장소에는 넣지 않는다.

- 실제 키: `var/secrets.env` (권한 600). 서버가 기동 시 읽어 환경변수로 올린다.
- `models/*/model.json`에는 `"api_key_env": "OPENAI_API_KEY"`처럼 **이름만** 적는다.
- `services/secrets.py`가 로딩·마스킹·오류 본문 세척(`scrub`)을 담당한다. 외부 API 오류를 그대로 전달할 때 키가 섞여 나가지 않는다.

## 백엔드

| 파일 | 변경 |
| --- | --- |
| `services/secrets.py` | 신규. 키 로딩, `mask`, `scrub` |
| `services/model_registry.py` | `provider_type`·`modality`·`remote_model`·`api_key_env` 추가, `label`(유형 괄호 표기), 가중치 경로의 `config.json`으로 VLM 판정 |
| `services/engines.py` | `RemoteApiEngine` 추가. OpenAI/Anthropic 요청·스트림 변환, 이미지 블록 변환, 공급자별 허용 필드 필터 |
| `services/serving_manager.py` | 모델에 따라 로컬/원격 엔진 선택. 원격은 프로세스 없이 즉시 준비 |
| `services/inference.py` | 자동 저장 제거, 이미지 검증·전달 |
| `services/judge.py` | 신규. 모범답변 기준 채점 |
| `services/parameter_catalog.py` | `providers`로 공급자별 노출 제한, 빈 목록은 요청에서 제외 |
| `api/routes.py` | `POST /runs`(저장), `GET /judges`, `/models?modality=`, compare 확장 |
| `config.py`, `main.py` | `secrets_file` 추가와 기동 시 로딩 |

**모델 스냅샷 비교**: `serve()`의 멱등 처리를 `model.id` 비교에서 **모델 전체 비교**로 바꿨다. TASK-004에서 발견한 "설정을 고쳐도 재기동을 건너뛰어 반영되지 않는" 문제가 함께 해소된다.

## 프론트엔드

| 요구 | 구현 |
| --- | --- |
| R1 저장 버튼 | 답변 패널에 `저장` 버튼. 완료된 답변에만 활성, 저장 후 `저장됨` |
| R2 답변 비우기 | 모델 변경·입력 변경 시 `clearAnswer()` |
| R3 라운드 탭 | `.tab`을 `border-radius: 999px` 버튼 박스로 |
| R4 접기/펼치기 | 모든 좌측 상자를 `section()` 헬퍼로 통일, 상태는 `collapsed`에 보관 |
| R5 우클릭 삭제 | 리스트·카드에 `contextmenu` 핸들러, `.context-menu`로 삭제 메뉴 |
| R6 탭 보기 | 선택된 실행을 탭으로 전환(`run-tabs`) |
| R7 버튼 폭 통일 | `.toolbar-actions .btn { width: 116px }` |
| R8 X는 숨기기 | `hiddenRunIds`로 화면에서만 제외, 서버 기록 유지 |
| R9 비교 창 | 모범답변 textarea + 심판 모델 select + 비교 버튼 |
| R11 유형 표기·필터 | 모델 옵션에 `(LLM)`/`(VLM)`, 사이드바에 유형 필터 |
| R12 이미지 입력 | VLM일 때만 첨부 버튼·칩 표시, data URI 전송 |
| R13 슬라이더 | 트랙 3px + 11px 원형 thumb |
| R14 스크롤바 | 폭 7px, `scrollbar-width: thin`, 사이드바는 어두운 색 |

## 등록한 외부 모델

공급자 API의 모델 목록을 조회해 실제 존재하는 이름으로 등록했다: `openai-gpt-5.5`, `openai-gpt-5.4-mini`, `claude-opus-5`, `claude-sonnet-5`.

## 공급자별 파라미터 차이 (실측)

| 파라미터 | OpenAI(gpt-5.4-mini) | Anthropic(claude-sonnet-5) |
| --- | --- | --- |
| temperature, top_p | 지원 | **거부**(deprecated) |
| top_k | — | **거부**(deprecated) |
| stop | **거부**(unsupported) | 지원(`stop_sequences`) |
| seed, frequency/presence_penalty, reasoning_effort | 지원 | — |
| max_tokens | `max_completion_tokens`로 매핑 | 필수 |

이 결과를 `parameters.json`의 `providers`와 어댑터의 허용 필드에 반영했다.

## 테스트

백엔드 42건(신규 4건), 프론트 13건. 실제 브라우저(CDP 실시간)로 화면 요구사항을 확인했다.
