# Project Source of Truth

Project: LLM Lab 모델 테스트 콘솔 (model_test)
Status: Development
Current Version: 0.2

로컬 모델을 하나씩 vLLM으로 서빙하면서, 파라미터를 바꿔가며 프롬프트 응답을 비교하는 사내 콘솔이다.
화면 기준은 `harness/templates/frontend/doc/images`의 두 이미지다.

작업 자동화는 `harness/docs/LOOP_ENGINEERING.md`의 PLAN → EXECUTE → VERIFY → commit → push 절차를 따른다.

## Canonical Documents

Architecture:
- docs/adr/

Functional Specification:
- docs/spec/SPEC.md
- docs/spec/features/

Test Policy:
- docs/tdd/TEST_STRATEGY.md

Current Work:
- docs/runs/
- docs/handoff/HANDOFF.md

## Runtime

- 콘솔 서버: 파이썬 3.12 표준 라이브러리만 사용. 추가 의존성 없음
- 서빙 엔진: vLLM 0.28.0 (프로젝트 루트 `.venv-vllm`에 격리 설치, torch 2.13.0+cu130)
- GPU: NVIDIA B200 1장(183GB). 한 번에 한 모델만 서빙한다
- 모델 가중치: `/NHNHOME/WORKSPACE/26mss001_H0/models` (등록부는 `models/`)

## Standard Commands

Install:
```sh
python3 -m venv .venv-vllm && .venv-vllm/bin/python -m pip install vllm   # 서빙 엔진(최초 1회)
```

Run:
```sh
sh src/backend/run.sh --host 0.0.0.0        # http://<서버IP>:8080
```

Test:
```sh
cd src/backend && python3 -m unittest discover -s tests -t .   # 백엔드 42건
sh src/frontend/tests/smoke.sh                                  # 프론트 12개 테스트 + Vite 빌드
```

Lint:
```
별도 린터를 도입하지 않았다. 코딩 규약은 harness/docs/를 따른다.
```

Build:
```sh
cd src/frontend && npm run build
```
Vite가 `src/frontend/dist`를 만들며, 백엔드는 `dist/index.html`이 있으면 그 산출물을 서빙한다.
