# models

서빙 대상 모델의 **등록부**입니다. 가중치는 여기에 두지 않고, 이미 내려받아 둔 공유 스토리지(`/NHNHOME/WORKSPACE/26mss001_H0/models`)를 `path`로 가리킵니다. 하위 디렉터리 하나가 모델 하나이며, `model.json`이 있으면 목록에 나타납니다.

## 등록된 모델

현재 등록부에는 로컬 5종과 외부 API 4종, 총 9종이 등록되어 있습니다. 외부 API 모델은 GPU를 사용하지 않습니다.

| id | 가중치 | 크기 | 비고 |
| --- | --- | --- | --- |
| `gpt-oss-120b` | `openai--gpt-oss-120b` | 65GB (MXFP4) | `reasoning_effort` 지원. 기동 약 750초(실측) |
| `qwen3.8-27b` | `Qwen--Qwen3.8-27B` | 52GB | `enable_thinking` 지원, 컨텍스트 262K. 기동 약 185초(실측) |
| `thinkingcap-qwen3.6-27b` | `bottlecapai--ThinkingCap-Qwen3.6-27B` | 56GB | 사고 과정 강화 파인튜닝(3.6 기반). 기동 약 110초(실측) |
| `gemma-4-31b-it` | `google--gemma-4-31B-it` | 63GB | 기동 약 165초(실측) |
| `exaone-4.5-33b` | `LGAI-EXAONE--EXAONE-4.5-33B` | 69GB | 기동 약 100초(실측). 멀티모달 비활성화 필요(아래 참고) |
| `claude-opus-5` | 외부 API (`claude-opus-5`) | — | Anthropic · VLM · reasoning |
| `claude-sonnet-5` | 외부 API (`claude-sonnet-5`) | — | Anthropic · VLM |
| `openai-gpt-5.4-mini` | 외부 API (`gpt-5.4-mini`) | — | OpenAI · VLM |
| `openai-gpt-5.5` | 외부 API (`gpt-5.5`) | — | OpenAI · VLM · reasoning |

`thinkingcap-qwen3.6-27b`는 Qwen3.6 기반이지만, 사고 과정을 강화한 파인튜닝이라 3.8과 비교할 대상으로 남겨두었다. 등록부 항목은 서빙과 무관하게 비용이 없으므로 유지한다. 필요 없어지면 디렉터리만 지우면 된다.

스토리지에는 이 밖에 `K-EXAONE-2.0-750B-A37B`(1.5TB), `zai-org--GLM-5.2-FP8`(756GB), `moonshotai--Kimi-K2.7-Code`(595GB)도 있지만 B200 한 장(183GB)에 올라가지 않아 등록하지 않았습니다. 임베딩·리랭커(`BAAI--bge-*`)와 TTS·Omni 모델은 채팅 서빙 대상이 아니라 제외했습니다.

## model.json

| 키 | 설명 |
| --- | --- |
| `id` | 서빙 이름이자 API 식별자. 생략하면 디렉터리 이름을 사용합니다. |
| `name` / `provider` / `description` | UI 모델 선택 영역에 표시됩니다. |
| `path` | 가중치 경로. 절대 경로 또는 이 디렉터리 기준 상대 경로. |
| `hf_id` | `path`가 없을 때 vLLM에 넘길 허깅페이스 저장소 id(다운로드가 발생합니다). |
| `capabilities` | `chat`, `reasoning`(thinking 표시), `reasoning_effort`(gpt-oss), `thinking_toggle`(Qwen3). 해당 값이 없으면 관련 파라미터가 UI에서 숨겨집니다. |
| `context_length` | UI 표시용 컨텍스트 길이. |
| `engine_args` | vLLM 실행 인자. `max-model-len`, `reasoning-parser`처럼 대시 표기를 그대로 씁니다. `true`는 플래그로만 전달됩니다. |
| `parameter_overrides` | 파라미터별 `default`, `min`, `max`, `options`, `hidden` 재정의. |

`exaone-4.5-33b`는 vLLM 0.28.0의 결함(`Exaone4_5_ForConditionalGeneration`이 Qwen2.5-VL 비디오 경로의 `input_norm`을 찾지 못함) 때문에 `limit-mm-per-prompt`로 이미지·비디오를 모두 0으로 막아야 기동한다. 텍스트 대화에는 영향이 없다. 사고 과정은 `<think>` 태그를 쓰므로 `deepseek_r1` 파서로 분리한다.

**모델 설정을 바꾼 뒤에는 서빙을 한 번 중단했다가 다시 시작해야 한다.** 이미 `ready`인 모델을 다시 선택하면 재기동을 건너뛰므로 변경이 반영되지 않는다.

기동 시간은 커널 캐시가 채워진 뒤의 실측값이다. 캐시가 비어 있는 최초 기동은 더 오래 걸리며, 대기 한도는 `MODEL_TEST_STARTUP_TIMEOUT`(기본 1800초)으로 조정한다.

새 모델을 추가하려면 디렉터리와 `model.json`만 만들면 되고 서버 재시작도 필요 없습니다. 목록은 요청 때마다 다시 스캔합니다. 기본 위치는 `MODEL_TEST_MODELS_DIR`로 바꿀 수 있습니다.
