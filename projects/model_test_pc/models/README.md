# models

호출할 엔드포인트 등록부입니다. 하위 디렉터리 하나가 모델 하나이며, `model.json`만 만들면 서버 재시작 없이 목록에 나타납니다. 가중치는 다루지 않습니다.

## 등록된 모델

| id | 제공자 | 주소 | 상태 |
| --- | --- | --- | --- |
| `openai-gpt-5.5` | OpenAI | api.openai.com | 사용 가능 |
| `openai-gpt-5.4-mini` | OpenAI | api.openai.com | 사용 가능 |
| `claude-opus-5` | Anthropic | api.anthropic.com | 사용 가능 |
| `claude-sonnet-5` | Anthropic | api.anthropic.com | 사용 가능 |
| `qwen3.8-27b` | HuggingFace | router.huggingface.co | **`HF_TOKEN` 필요** |
| `gpt-oss-120b` | 사내 엔드포인트 | `${APP_GPTOSS_BASE_URL}` | **내부망에서만 호출 가능** |

### gpt-oss-120b

사내 방화벽 때문에 **내부망 밖에서는 호출되지 않습니다.** 외부에서 실행하면 주소가 없어 목록에서 빠지고, 주소를 넣어도 `provider_unreachable` 오류가 납니다. 내부망 PC에서 아래처럼 실행하면 그때 목록에 나타납니다.

```sh
APP_GPTOSS_BASE_URL="http://<사내 엔드포인트>/v1" sh src/backend/run.sh --host 0.0.0.0
```

키가 필요하면 `model.json`에 `"api_key_env": "<환경변수 이름>"`만 추가합니다. 그 엔드포인트가 vLLM이 아니라면 `parameter_profile`을 `openai`로 바꾸는 편이 안전합니다(확장 필드 미노출).

### qwen3.8-27b

HuggingFace Inference Providers 경유입니다. 2026-09-07 기준 `featherless-ai`, `ovhcloud`, `deepinfra` 세 곳이 제공 중입니다. huggingface.co → Settings → Access Tokens에서 **read** 토큰을 만들어 넣습니다.

```sh
echo 'HF_TOKEN=hf_...' >> var/secrets.env
```

제공자를 고정하려면 `remote_model`을 `Qwen/Qwen3.8-27B:deepinfra`처럼 적습니다. 지정하지 않으면 HF가 고릅니다.

## model.json

| 키 | 설명 |
| --- | --- |
| `id` | API 식별자. 생략하면 디렉터리 이름 |
| `name` / `provider` / `description` | 화면 표시용 |
| `provider_type` | 호출 규격. `openai`(OpenAI 및 호환) 또는 `anthropic` |
| `base_url` | 엔드포인트 주소. `${환경변수}` 표기 가능. 값이 없으면 목록에서 제외 |
| `remote_model` | 공급자가 아는 모델 이름 |
| `api_key_env` | 키가 필요할 때 그 **환경변수 이름**(키 값을 적지 않는다) |
| `modality` | `LLM` / `VLM`. VLM만 이미지 첨부가 열린다 |
| `parameter_profile` | 파라미터 노출 기준. 생략하면 `provider_type`. vLLM 엔드포인트는 `vllm` |
| `unsupported_fields` | 그 모델이 거부하는 필드. 요청에서 빼고 화면에서도 감춘다 |
| `uses_completion_tokens` | `max_tokens` 대신 `max_completion_tokens`를 받는 모델 |
| `parameter_overrides` | 파라미터별 기본값·범위 재정의 |

## 모델별 파라미터 차이 (실측)

공급자가 거부하는 필드는 `unsupported_fields`에 적어야 호출이 성공합니다.

| 모델 | 거부하는 필드 |
| --- | --- |
| GPT-5.5 (추론 모델) | `temperature`, `top_p`, `frequency_penalty`, `presence_penalty`, `logprobs`, `top_logprobs`, `stop` |
| GPT-5.4 mini | `stop` |
| Claude 최신 계열 | `temperature`, `top_p`, `top_k` |

새 모델에서 `unsupported_value`/`unsupported_parameter` 오류가 나면 그 필드를 추가하면 됩니다.
