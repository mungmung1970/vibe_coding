# Project Source of Truth

Project: LLM Lab 모델 테스트 콘솔 · PC판 (model_test_pc)
Status: Development
Current Version: 0.1

사내 엔드포인트와 외부 API(OpenAI·Anthropic) 모델을 한 화면에서 비교하는 콘솔이다.
**모델을 직접 서빙하지 않으므로 GPU도 vLLM도 필요 없다.** GPU가 없는 PC에서 그대로 실행된다.

`projects/model_test`(로컬 vLLM 서빙판)와 화면·기능은 같고, 서빙 계층만 없다.

작업 자동화는 `/home/surromind/workspace/harness/docs/LOOP_ENGINEERING.md`의 PLAN → EXECUTE → VERIFY → commit → push 절차를 따른다.

## Canonical Documents

Architecture: docs/adr/
Functional Specification: docs/spec/SPEC.md
Test Policy: docs/tdd/TEST_STRATEGY.md
Current Work: docs/runs/, docs/handoff/HANDOFF.md

## Runtime

- 백엔드: 파이썬 3.12 표준 라이브러리만. 추가 의존성 없음
- 프론트엔드: React 19 + Vite (빌드 산출물 `src/frontend/dist`를 백엔드가 서빙)
- 모델: 등록부(`models/*/model.json`)에 적힌 HTTP 엔드포인트만 호출
- API 키: `var/secrets.env` (저장소 제외, 권한 600)

## Standard Commands

Install:
```sh
cd src/frontend && npm install
```

Run:
```sh
APP_GPTOSS_BASE_URL="http://<사내 엔드포인트>/v1" sh src/backend/run.sh --host 0.0.0.0
```

Test:
```sh
cd src/backend && python3 -m unittest discover -s tests -t .   # 41건
sh src/frontend/tests/smoke.sh                                  # 12개 + 빌드
```

Build:
```sh
cd src/frontend && npm run build
```
