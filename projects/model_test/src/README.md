# model_test · LLM Lab

`harness/templates/frontend/doc/images`의 두 화면을 기준으로 만든 모델 테스트 콘솔입니다. 왼쪽에서 모델과 파라미터를 고르고, 가운데에서 프롬프트를 입력하면 오른쪽에 결과가 스트리밍으로 표시됩니다. 모델을 바꾸면 이전 서빙을 중단하고 선택한 모델 하나만 vLLM으로 서빙합니다.

```text
src/
├── backend/    파이썬 표준 라이브러리만 사용하는 API + 정적 파일 서버
└── frontend/   의존성 없는 바닐라 ES 모듈 화면 (하니스 프론트 템플릿 구조/토큰 준수)
models/         서빙 대상 모델 디렉터리 (models/README.md 참고)
```

## 실행

```sh
sh src/backend/run.sh                 # http://127.0.0.1:8080 (이 장비에서만 접속)
sh src/backend/run.sh --host 0.0.0.0  # 다른 PC에서도 접속 (http://<서버IP>:8080)
sh src/backend/run.sh --port 9000 --engine vllm
```

백엔드가 `src/frontend`를 그대로 서빙하므로 별도 빌드나 정적 서버가 필요 없습니다. 프론트만 따로 띄울 때는 `globalThis.MODEL_TEST_API_BASE`로 API 주소를 지정하면 됩니다.

`index.html`을 파일로 직접 열면(`file://`) ES 모듈과 API 호출이 모두 차단되므로, 반드시 위 주소로 접속해야 합니다.

### 다른 PC에서 접속

기본값 `127.0.0.1`은 서버 장비 안에서만 열립니다. 원격 접속이 필요하면 모든 인터페이스에 바인딩하세요.

```sh
sh src/backend/run.sh --host 0.0.0.0            # 또는 MODEL_TEST_HOST=0.0.0.0
```

접속 주소는 `http://<서버IP>:8080/`입니다(서버IP는 `ip -4 addr show scope global`로 확인). 인증이 없는 콘솔이므로 신뢰할 수 있는 사내망에서만 열고, 필요 없어지면 `127.0.0.1`로 되돌리는 편이 안전합니다. 컨테이너에서 실행 중이라면 `-p 8080:8080`처럼 포트가 게시되어 있어야 합니다.

### 엔진

| 값 | 동작 |
| --- | --- |
| `auto` (기본) | 현재 인터프리터와 `.venv-vllm`에서 vLLM을 찾아 사용. 없으면 오류로 중단합니다 |
| `vllm` | 탐색 없이 `vllm.entrypoints.openai.api_server`를 자식 프로세스로 기동 |

대체(mock) 엔진은 두지 않습니다. vLLM이 없으면 가짜 답변을 내보내는 대신 기동을 거부합니다 — 테스트용 대역은 `tests/support.py`의 `StubEngine`에만 있습니다.

vLLM은 프로젝트 루트의 별도 가상환경 `.venv-vllm`에 설치되어 있습니다. 이 장비의 torch는 NVIDIA 컨테이너 빌드라서 PyPI vLLM이 덮어쓰면 컨테이너 환경이 깨지므로, 격리해 두고 서빙 프로세스만 그 인터프리터로 띄웁니다.

```sh
python3 -m venv .venv-vllm
.venv-vllm/bin/python -m pip install vllm
```

`engine=auto`는 현재 인터프리터뿐 아니라 `.venv-vllm`도 확인해서 vLLM이 있으면 실제 엔진을 씁니다. 다른 위치를 쓰려면 `MODEL_TEST_VLLM_VENV`로 지정하고, 실행 명령 자체를 바꾸려면 `MODEL_TEST_VLLM_COMMAND="vllm serve"`를 씁니다. 모델별 인자는 `model.json`의 `engine_args`에 둡니다 — 추론 스트림(thinking)을 보려면 모델에 맞는 `reasoning-parser`가 필요합니다(gpt-oss는 `openai_gptoss`, Qwen3는 `qwen3`).

첫 서빙은 수십 GB 가중치를 읽어 GPU에 올리므로 수 분이 걸립니다. 첫 기동은 커널(flashinfer) 컴파일까지 겹쳐 10분을 넘길 수 있습니다. 기본 대기 한도는 1800초이며 `MODEL_TEST_STARTUP_TIMEOUT`으로 조정합니다.

가중치는 이미 `/NHNHOME/WORKSPACE/26mss001_H0/models`에 받아둔 것을 씁니다. `models/<id>/model.json`의 `path`가 그 경로를 가리키므로 다운로드는 일어나지 않습니다.

### 외부 API 모델

로컬 vLLM 모델과 함께 OpenAI·Anthropic 모델을 같은 화면에서 쓸 수 있다. 원격 모델은 서빙할 프로세스가 없으므로 선택 즉시 준비 상태가 되고, GPU를 쓰지 않는다(로컬 모델이 서빙 중이었다면 중단된다).

등록 방법은 로컬 모델과 같다 — `models/<id>/model.json`에 공급자 정보를 적는다.

```json
{
  "id": "openai-gpt-5.5", "name": "GPT-5.5", "provider": "OpenAI",
  "provider_type": "openai", "remote_model": "gpt-5.5",
  "api_key_env": "OPENAI_API_KEY", "modality": "VLM", "capabilities": ["chat"]
}
```

**API 키는 저장소에 두지 않는다.** `model.json`에는 환경변수 이름만 적고, 실제 키는 `var/secrets.env`(권한 600)에 `KEY=VALUE`로 둔다. 서버가 기동 시 읽어 환경변수로 올리며, 로그·오류 메시지에 값이 섞여 나가지 않도록 마스킹한다.

```sh
# var/secrets.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 모델 유형과 이미지 입력

모델 이름 옆 괄호가 유형이다(`Qwen3.8-27B (VLM)`). `model.json`의 `modality`로 지정하고, 없으면 가중치의 `config.json`에 비전 설정이 있는지로 판정한다. 사이드바의 모델 유형 필터로 LLM/VLM만 골라 볼 수 있다.

VLM 모델을 서빙하면 입력 패널에 이미지 첨부 버튼이 생긴다. 이미지는 data URI로 전송되며(최대 4장, 장당 약 6MB), OpenAI 형식으로 통일해 보내고 Anthropic 형식 변환은 엔진 어댑터가 처리한다. LLM 모델에 이미지를 보내면 422로 거부된다.

### 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MODEL_TEST_HOST` / `MODEL_TEST_PORT` | `127.0.0.1` / `8080` | 콘솔 바인딩 주소 |
| `MODEL_TEST_MODELS_DIR` | `<project>/models` | 모델 디렉터리 |
| `MODEL_TEST_ENGINE` | `auto` | 서빙 엔진 |
| `MODEL_TEST_VLLM_HOST` / `MODEL_TEST_VLLM_PORT` | `127.0.0.1` / `8000` | vLLM 서버 주소 |
| `MODEL_TEST_VLLM_COMMAND` | `.venv-vllm` 파이썬 모듈 실행 | vLLM 기동 명령 |
| `MODEL_TEST_VLLM_VENV` | `<project>/.venv-vllm` | vLLM이 설치된 가상환경 |
| `MODEL_TEST_STARTUP_TIMEOUT` | `1800` | 서빙 준비 대기 한도(초) |
| `MODEL_TEST_VAR_DIR` | `<project>/var` | 실행 기록·로그 저장 위치 |
| `MODEL_TEST_PARAMETERS_FILE` | `app/data/parameters.json` | 파라미터 정의 파일 |

## 파라미터 정의

모델에 전달할 수 있는 모든 파라미터는 [backend/app/data/parameters.json](backend/app/data/parameters.json) 한 곳에서 관리합니다. 항목마다 컨트롤 종류(`range`, `number`, `select`, `checkbox`, `tags`), 타입, 범위, 기본값, 그리고 **요청의 어느 자리로 들어가는지**(`target`)를 정의합니다.

| target | 전달 위치 |
| --- | --- |
| `body` | OpenAI 호환 요청 본문 (`temperature`, `max_tokens` 등) |
| `extra_body` | vLLM 확장 필드 (`top_k`, `min_p`, `repetition_penalty` 등) |
| `chat_template_kwargs` | 채팅 템플릿 인자 (`reasoning_effort`) |
| `client` | 화면 동작 전용 (`show_thinking`, `stream`) |

각 항목의 `providers`는 그 파라미터를 받는 공급자를 제한한다(예: `repetition_penalty`는 `local`만). 최신 OpenAI 모델은 `stop`을, 최신 Claude 모델은 `temperature`·`top_p`·`top_k`를 거부하므로 해당 모델에서는 화면에도 나오지 않는다.

`requires_capability`가 있는 항목은 모델의 `capabilities`에 해당 값이 있을 때만 노출됩니다 — `reasoning`은 thinking 표시, `reasoning_effort`는 gpt-oss 계열, `thinking_toggle`은 Qwen3 계열의 `enable_thinking`에 해당합니다. `model.json`의 `parameter_overrides`로 모델별 기본값·범위·숨김을 바꿀 수 있습니다. 백엔드는 들어온 값을 이 정의로 검증(범위/타입/선택지)한 뒤 각 자리로 나눠 담기 때문에, 파라미터를 추가할 때 JSON만 고치면 화면과 요청이 함께 바뀝니다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/v1/health` | 상태와 현재 엔진 |
| `GET` | `/api/v1/models` | 모델 목록과 제공자 |
| `GET` | `/api/v1/serving` | 서빙 상태 (`idle`/`starting`/`ready`/`stopping`/`error`) |
| `POST` | `/api/v1/serving` | `{"model_id": "..."}` — 기존 서빙 중단 후 해당 모델 서빙 |
| `DELETE` | `/api/v1/serving` | 서빙 중단 |
| `GET` | `/api/v1/serving/logs?tail=200` | 엔진 로그 tail |
| `GET` | `/api/v1/parameters?model_id=` | 모델에 맞춘 파라미터 스키마와 기본값 |
| `POST` | `/api/v1/generate` | 프롬프트 실행. 기본은 SSE 스트리밍, `"stream": false`면 단일 JSON |
| `GET` | `/api/v1/runs` | 실행 기록 조회 (`model_id`, `q`, `from`, `to`, `limit`) |
| `GET`/`DELETE` | `/api/v1/runs/{id}` | 실행 기록 상세/삭제 |
| `POST` | `/api/v1/runs` | `{"run": {...}}` — 저장 버튼으로 실행 결과를 기록에 남긴다 |
| `POST` | `/api/v1/runs/compare` | `{"run_ids": [...], "reference": "", "judge_model_id": ""}` — 답변·파라미터 비교, 모범답변과 심판 모델이 있으면 채점 |
| `GET` | `/api/v1/judges` | 채점에 쓸 수 있는 모델 목록 |

생성은 **아무것도 자동 저장하지 않는다.** 답변 패널의 저장 버튼이 `POST /runs`를 호출할 때만 기록에 남는다.

`/generate` 스트림은 `start` → (`reasoning`·`delta`) → `done` 순서의 SSE 이벤트이며, 오류는 `error` 이벤트 또는 HTTP 오류로 전달됩니다. 오류 응답 형식은 `{"error": {"code", "message", "details"}}`로 통일했습니다.

## 소스 경계

백엔드는 `core`(HTTP 원시 계층) → `services`(도메인) → `api`(경로 연결) 방향으로만 의존합니다. `services/serving_manager.py`가 "한 번에 한 모델" 불변식을 지키고, `services/engines.py`가 프로세스 기동/중단과 스트리밍을, `services/parameter_catalog.py`가 파라미터 검증을 담당합니다.

프론트엔드는 하니스 표준(`harness/docs/FRONTEND_STANDARD.md`)대로 `components`(렌더링), `data`(상태 모양), `state`(상태 전이), `services`(API), `styles`(토큰), `utils`(순수 함수)로 나뉘며 컴포넌트에서 직접 `fetch`하지 않습니다. 입력·슬라이더·스트리밍 텍스트는 `store.setQuiet`으로 저장해 타이핑 중 리렌더가 끼어들지 않도록 했습니다.

## 검증

```sh
cd src/backend && python3 -m unittest discover -s tests -t .   # 36 tests
sh src/frontend/tests/smoke.sh                                  # 파싱 + 단위 테스트
```
