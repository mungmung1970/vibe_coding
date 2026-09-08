# model_test · LLM Lab 모델 테스트 콘솔

로컬 모델을 하나씩 vLLM으로 서빙하면서 파라미터를 바꿔 응답을 비교하는 사내 콘솔이다.

## 먼저 읽을 것

1. `docs/sot/SOT.md` — 프로젝트 정의, 런타임, 표준 명령
2. `docs/spec/SPEC.md` — 기능 요구사항(F1~F4). 개별 기능은 `docs/spec/features/`
3. `docs/adr/ADR-0001.md` — 콘솔과 서빙 엔진을 분리한 이유
4. `docs/handoff/HANDOFF.md` — 현재 상태와 인계 사항
5. `src/README.md` — 구조·API·환경 변수

작업은 `/home/surromind/workspace/.codex/AGENTS.md`의 PLAN → EXECUTE → VERIFY를 따르고, 기록은 `docs/runs/TASK-*/`에 남긴다.
반복 수정·검증·커밋·push는 `/home/surromind/workspace/harness/docs/LOOP_ENGINEERING.md`를 따른다.

## 구조

```text
src/backend/    파이썬 표준 라이브러리만 쓰는 API + 정적 서버 (core → services → api)
src/frontend/   React 19 + Vite 화면 (components/features/data/state/services/styles/utils)
models/         모델 등록부. 가중치는 공유 스토리지를 path로 참조
.venv-vllm/     서빙 엔진(vLLM) 격리 설치. 콘솔이 이 인터프리터로 자식 프로세스를 띄운다
```

## 반드시 지킬 것

- **한 번에 한 모델만 서빙한다.** 모델 전환은 기존 프로세스를 정리한 뒤 시작한다(`services/serving_manager.py`).
- **대체(mock) 엔진을 만들지 않는다.** vLLM이 없으면 가짜 답변 대신 기동을 거부한다(ADR-0001). 테스트 대역은 `tests/support.py`에만 둔다.
- **파라미터는 `app/data/parameters.json` 한 곳에서 정의한다.** 화면 컨트롤·요청 전달 위치·검증이 모두 이 정의에서 파생된다. 컴포넌트에 파라미터를 하드코딩하지 않는다.
- **프론트 컴포넌트에서 직접 `fetch`하지 않는다.** 모든 호출은 `src/services/api.js`를 거친다(`harness/docs/FRONTEND_STANDARD.md`).
- **콘솔 서버에 서드파티 의존성을 추가하지 않는다.** 실행 환경의 torch 빌드를 보호하기 위한 제약이다.

## 검증

```sh
cd src/backend && python3 -m unittest discover -s tests -t .   # 42건
sh src/frontend/tests/smoke.sh                                  # 12개 테스트
```

화면 변경은 실제 브라우저로 확인한다. 헤드리스 크롬의 `--virtual-time-budget`은 스트리밍 타이밍을 왜곡하므로 타이밍 확인에는 쓰지 않는다.
