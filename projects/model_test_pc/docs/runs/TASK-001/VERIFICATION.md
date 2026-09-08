# TASK-001 · VERIFICATION

검증일: 2026-09-07
방법: 백엔드 테스트 41건(외부 API 미사용) + 실제 API 호출 + 실제 브라우저(CDP)

## 인수 조건 결과

| # | 조건 | 결과 | 근거 |
| --- | --- | --- | --- |
| AC1 | vLLM·서빙 코드가 남지 않음 | **통과** | `serving_manager.py`·`engines.py` 삭제, 소스에 `serving` 참조 없음, `/serving*` 경로가 모두 404(테스트로 고정) |
| AC2 | 등록부가 엔드포인트/외부 API로만 구성 | **통과** | 5종: 사내 엔드포인트 1 + OpenAI 2 + Anthropic 2 |
| AC3 | 외부 API 실제 생성 성공 | **통과** | GPT-5.4 mini 2,011ms / Claude Sonnet 5 3,222ms, 정상 한국어 답변 |
| AC4 | 엔드포인트는 설정만으로 전환, 미도달 시 명확한 오류 | **통과** | 아래 참조 |
| AC5 | 화면에 서빙 UI 없음, 나머지 동일 | **통과** | 서빙 시작/중단/로그 버튼 없음, 상태는 "사용 가능", 스트리밍·저장 정상 |
| AC6 | 테스트 통과 | **통과** | 백엔드 41건, 프론트 12개 + 빌드 |
| AC7 | 기존 model_test 무변경 | **통과** | 별도 디렉터리에만 작업 |

## 엔드포인트 처리 (AC4)

주소는 `models/gpt-oss-120b/model.json`의 `"base_url": "${APP_GPTOSS_BASE_URL}"`로 주입한다.

| 상황 | 동작 |
| --- | --- |
| 환경변수 미설정 | 목록에서 제외하고 기동 로그에 경고. 호출 불가한 주소가 화면에 뜨지 않는다 |
| 설정됨 | `http://gptoss.internal:8000/v1`로 등록되고 파라미터 프로필 `vllm` 적용(확장 필드 18개 노출) |
| 접속 불가 | `provider_unreachable` — "'gpt-oss-120b' 엔드포인트(http://gptoss.internal:8000/v1)에 연결할 수 없습니다: Name or service not known" |

이 GPU 서버에서는 사내 엔드포인트에 접속되지 않으므로 **실제 생성은 검증하지 못했다.** 주소가 닿는 PC에서 확인이 필요하다. 프로토콜은 OpenAI 호환이며 같은 경로를 OpenAI 모델로 실호출해 검증했다.

## 공급자 어댑터 (외부 호출 없이)

`tests/support.py`의 가짜 공급자 서버로 실제 소켓·SSE 경계를 시험한다.

- OpenAI 규격: 모델·메시지·`reasoning_effort` 전달, `Authorization` 헤더, `max_tokens → max_completion_tokens` 변환, `unsupported_fields` 제거
- Anthropic 규격: system 분리, `stop → stop_sequences`, 이미지 base64 블록 변환, 스트림을 OpenAI 청크로 변환
- 오류: 키 누락은 호출 전에 차단, 4xx는 `provider_error`, 연결 실패는 `provider_unreachable`

## 화면 (AC5)

```
모델 옵션 = Claude Opus 5 (VLM) | Claude Sonnet 5 (VLM)
제공자    = Anthropic | OpenAI | 사내 엔드포인트
서빙 버튼 = 없음          상태 표시 = 사용 가능
스트리밍  = "안녕하세요! 반갑습니다. 무엇을 도와드릴까요?"
저장 후   = 저장됨
```

## 남은 사항

- **사내 엔드포인트 주소가 아직 비어 있다.** `APP_GPTOSS_BASE_URL`에 실제 주소를 넣으면 바로 목록에 나타난다. 키가 필요하면 `model.json`에 `api_key_env`만 추가하면 된다.
- 그 엔드포인트가 vLLM이 아니라면 `parameter_profile`을 `openai`로 바꾸는 편이 안전하다(확장 필드 미노출).
- 검증자가 구현자와 동일하다.
