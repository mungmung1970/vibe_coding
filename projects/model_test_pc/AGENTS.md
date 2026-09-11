# model_test_pc · LLM Lab 콘솔 (PC판)

사내 엔드포인트와 외부 API(OpenAI·Anthropic) 모델을 한 화면에서 비교하는 콘솔.
**모델을 서빙하지 않는다** — GPU도 vLLM도 필요 없다.

`projects/model_test`(vLLM 서빙판)와 화면·기능은 같고 서빙 계층만 없다. 두 프로젝트는 독립적이다.

## 먼저 읽을 것

1. `docs/sot/SOT.md` — 정의·런타임·표준 명령
2. `docs/spec/SPEC.md` — 기능 요구사항
3. `docs/adr/ADR-0001.md` — 서빙을 두지 않은 이유
4. `src/README.md` — 구조·API·설정

작업은 `/home/surromind/workspace/.codex/AGENTS.md`의 PLAN → EXECUTE → VERIFY를 따르고 기록은 `docs/runs/TASK-*/`에 남긴다.
반복 수정·검증·커밋·push는 `/home/surromind/workspace/harness/docs/LOOP_ENGINEERING.md`를 따른다.

## 반드시 지킬 것

- **서빙 개념을 되살리지 않는다.** 모델은 등록된 엔드포인트를 호출할 뿐이다. 프로세스 기동·상태 기계·대기 화면을 추가하지 않는다.
- **파라미터는 `app/data/parameters.json` 한 곳에서 정의한다.** 노출 기준은 모델의 파라미터 프로필이다.
- **공급자 차이는 `services/providers.py`에만 둔다.** 상위 계층은 OpenAI 청크 모양 하나만 안다.
- **API 키는 `var/secrets.env`에만 둔다.** 등록부에는 환경변수 이름만 적고, 로그·오류에 값이 섞이지 않게 `scrub()`을 거친다.
- **프론트 컴포넌트에서 직접 `fetch`하지 않는다.** 모든 호출은 `src/services/api.js`를 거친다.
- **백엔드에 서드파티 의존성을 추가하지 않는다.**

## 검증

```sh
cd src/backend && python3 -m unittest discover -s tests -t .   # 60건
sh src/frontend/tests/smoke.sh                                  # 12개 + 빌드
```

외부 API를 호출하지 않고도 전부 통과해야 한다. 공급자 어댑터는 `tests/support.py`의 가짜 서버로 HTTP 경계까지 시험한다.
