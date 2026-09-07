# TASK-004 · EXECUTION

실행일: 2026-09-07
계획: docs/runs/TASK-004/PLAN.md

## 1. 잔여 모델 실서빙 검증

`thinkingcap-qwen3.6-27b` → `gemma-4-31b-it` → `exaone-4.5-33b` 순으로 하나씩 서빙하고, 각 모델에서 파라미터 노출과 생성 1회를 확인했다. 결과는 VERIFICATION에 기록한다.

검증 절차는 `docs/tdd/TEST_STRATEGY.md`의 "수동 검증(실모델)" 5단계를 그대로 따랐다.

## 2. 문서 완성

### docs/adr/ADR-0001.md

"콘솔 서버와 서빙 엔진의 분리" 결정을 기록했다. 맥락(NVIDIA torch 보호, GPU 1장, 수 분의 로딩), 결정(표준 라이브러리 콘솔 + `.venv-vllm` 자식 프로세스 + 상태 기계), 기각한 대안 4가지, 결과의 장단점, 그리고 관련 결정(mock 엔진 부재)까지 담았다.

### docs/tdd/TEST_STRATEGY.md

실제 구성을 기준으로 작성했다. 원칙 4개(GPU 없이 전부 실행, 가짜는 테스트 코드에만, 결함마다 회귀 테스트, 화면은 실제 브라우저로 확인), 계층별 테스트 위치와 건수, 실행 명령, **실제 장애에서 유래한 회귀 목록 4건**, 실모델 수동 검증 절차, 하지 않는 것.

### docs/handoff/HANDOFF.md

현재 상태(실행 중인 콘솔·엔진·모델·테스트), 인수인계 시 바로 알아야 할 5가지(단일 서빙, 파라미터 단일 정의, 모델 추가 방법, 대체 엔진 부재, 프론트 빌드 없음), 자주 쓰는 명령, 알려진 한계, 다음 작업 후보를 정리했다.

## 3. 계획 범위 추가 (사후 기록)

작업 중 다음 두 가지를 계획에 없던 항목으로 처리했다. 하니스가 작업 시작 시 가장 먼저 읽도록 규정한 파일이 비어 있거나 잘못된 내용이어서, 문서 완성이라는 이번 작업 목적과 직접 맞닿아 있다고 판단했다.

- `AGENTS.md`(프로젝트 진입 문서)가 빈 파일이었다 → 읽을 순서, 구조, 반드시 지킬 규칙(단일 서빙·mock 금지·파라미터 단일 정의·컴포넌트 fetch 금지·무의존성), 검증 명령을 작성했다.
- `.agents/skills/project-domain/SKILL.md`과 `.agents/skills/project-deploy/SKILL.md`이 **둘 다 다른 프로젝트(AIOps)의 동일한 자리표시자 내용**이었다(이름도 `aiops-domain`으로 중복) → 각각 도메인 작업 지침과 실행·운영 지침으로 다시 썼다.

## 4. EXAONE 4.5 기동 실패와 조치

1차 기동이 종료 코드 1로 실패했다. 로그의 근본 원인은 vLLM 0.28.0 쪽 결함이다.

```
AttributeError: 'Exaone4_5_ForConditionalGeneration' object has no attribute 'input_norm'
  vllm/model_executor/models/qwen2_5_v...  _process_video_input → self.input_norm(...)
```

멀티모달 프로파일링에서 더미 비디오 입력을 처리하다가 Qwen2.5-VL 경로의 속성을 EXAONE 모델에서 찾지 못했다. 콘솔 결함이 아니다.

조치로 `models/exaone-4.5-33b/model.json`의 `engine_args`에 `"limit-mm-per-prompt": "{\"video\": 0}"`을 추가해 비디오 입력을 0으로 제한하고 재시도했다. 설정 변경이며 제품 소스는 손대지 않았다.

## 5. 제품 소스 변경

없음. 변경은 문서와 모델 등록부 설정에 한정된다.
