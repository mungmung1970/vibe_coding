# TASK-004 · VERIFICATION

검증일: 2026-09-07
환경: vLLM 0.28.0(`.venv-vllm`), NVIDIA B200 1장, 커널 캐시 예열 상태

## 인수 조건 결과

| # | 조건 | 결과 | 근거 |
| --- | --- | --- | --- |
| AC1 | 3종 모두 `ready` 도달 또는 원인 기록 | **통과** | 3종 모두 `ready`. EXAONE는 2회 실패 후 설정 조정으로 성공(원인 아래 기록) |
| AC2 | 각 모델 실제 생성 1회 이상 | **통과** | 아래 표 |
| AC3 | 추론 파서 유무가 SPEC대로 동작 | **통과** | 파서 설정 모델은 사고 분리, Gemma는 이 프롬프트에서 사고 미발생 |
| AC4 | 파라미터 노출이 모델 능력과 일치 | **통과** | ThinkingCap `[show_thinking, enable_thinking]`, EXAONE `[show_thinking]`, 파서 없던 시점엔 `[]` |
| AC5 | 문서가 실제 구현과 일치 | **통과** | ADR·테스트 전략·핸드오프의 명령을 실행해 확인(백엔드 37건·프론트 13건) |
| AC6 | 종료 시 정상 서빙 상태 | **통과** | `exaone-4.5-33b` ready |
| AC7 | 회귀 없음 | **통과** | 백엔드 37건, 프론트 13건 |

## 모델별 결과

| 모델 | 기동 | 생성 지연 | 완료 토큰 | 사고 스트림 |
| --- | --- | --- | --- | --- |
| `thinkingcap-qwen3.6-27b` | 110초 | 6,385ms | 574 | 분리됨(사고 502토큰) |
| `gemma-4-31b-it` | 164초 | 2,207ms | 77 | 이 응답에서는 미발생(파서는 `gemma4`로 설정됨) |
| `exaone-4.5-33b` | 100초 | 2,799ms | 220 | 분리됨(`deepseek_r1` 파서 적용 후) |

세 모델 모두 한국어 답변이 정상적으로 생성되었다.

## EXAONE 4.5 기동 실패 원인과 조치

**원인은 vLLM 0.28.0의 결함이다.** 콘솔 코드 문제가 아니다.

```
AttributeError: 'Exaone4_5_ForConditionalGeneration' object has no attribute 'input_norm'
  vllm/model_executor/models/qwen2_5_v… _process_video_input → self.input_norm(...)
```

멀티모달 더미 프로파일링이 Qwen2.5-VL 코드 경로를 타면서 EXAONE 모델에 없는 속성을 참조한다.

| 시도 | 설정 | 결과 |
| --- | --- | --- |
| 1 | 기본 | 실패(종료 코드 1) |
| 2 | `limit-mm-per-prompt {"video": 0}` | 실패 — 인자는 반영되었으나(`limit_mm_per_prompt: {'video': 0}`) 더미 프로파일링은 여전히 비디오 경로 실행 |
| 3 | `limit-mm-per-prompt {"image": 0, "video": 0}` | **성공(100초)** |

텍스트 대화만 쓰는 이 콘솔에서는 멀티모달 비활성화가 기능 손실이 아니다. 설정은 `models/exaone-4.5-33b/model.json`에 반영했고, 근거를 `models/README.md`에 남겼다.

추가로 EXAONE는 초기에 사고 과정을 답변 본문에 그대로 섞어 출력했다(`Okay, the user is asking...`). 채팅 템플릿이 `<think>` 태그를 쓰므로 공통 파서 `deepseek_r1`을 설정해 분리했고, `capabilities`에 `reasoning`을 추가해 thinking 표시 옵션이 노출되도록 했다.

## 부수 발견 (제품 결함 아님, 개선 후보)

**이미 `ready`인 모델을 다시 선택하면 재기동을 건너뛴다.** `serving_manager.serve()`가 같은 모델 요청을 멱등 처리하기 때문인데, 그 사이 `model.json`을 고쳐도 반영되지 않는다. 실제로 이번 검증에서 파서 설정이 적용되지 않아 한 차례 오진할 뻔했다(서빙 중 스냅샷은 `['chat']`, 등록부는 `['chat','reasoning']`).

- 현재 회피법: 서빙을 중단했다가 다시 시작한다. `models/README.md`에 명시했다.
- 개선안: `serve()`에서 보관 중인 모델 스냅샷과 새로 읽은 값을 비교해 다르면 재기동한다. 별도 작업으로 제안한다.

## 문서 완성 (AC5)

| 문서 | 내용 |
| --- | --- |
| `docs/adr/ADR-0001.md` | 콘솔·엔진 분리 결정. 맥락, 기각한 대안 4가지, 장단점, mock 미도입 결정 |
| `docs/tdd/TEST_STRATEGY.md` | 원칙 4개, 계층별 구성, 실행 명령, 실제 장애 유래 회귀 4건, 실모델 수동 검증 5단계 |
| `docs/handoff/HANDOFF.md` | 현재 상태, 바로 알아야 할 5가지, 자주 쓰는 명령, 한계, 다음 작업 후보 |
| `AGENTS.md` (범위 추가) | 비어 있던 프로젝트 진입 문서 작성 |
| `.agents/skills/*` (범위 추가) | 다른 프로젝트(AIOps) 내용이 중복 복사돼 있던 스킬 2개를 이 저장소 기준으로 재작성 |

## 남은 사항

- 하니스 규약의 **독립 검증**은 여전히 미충족(구현자와 검증자가 동일).
- Gemma 4의 사고 분리는 사고를 유도하는 프롬프트로 재확인이 필요하다. 이번 프롬프트에서는 사고 출력 자체가 없었다.
- 모델 설정 변경 시 자동 재기동(위 부수 발견)은 미해결.
