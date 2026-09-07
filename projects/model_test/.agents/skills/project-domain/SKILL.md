---
name: model-test-domain
description: Use when changing model serving, the parameter catalog, prompt execution, or run history in the model_test console.
---

# 모델 테스트 콘솔 도메인

## 언제 쓰나

모델 등록·서빙 수명주기, 파라미터 카탈로그, 프롬프트 실행/스트리밍, 실행 기록·비교를 건드릴 때.

## 먼저 읽을 것

- `docs/spec/SPEC.md` F1~F4와 해당 기능의 `docs/spec/features/`
- `docs/adr/ADR-0001.md` (콘솔·엔진 분리)
- 바꾸려는 계층의 소스: `src/backend/app/services/` 또는 `src/frontend/src/`

## 절차

1. **서빙 관련**: 상태 전이는 `serving_manager.py`에서만 바꾼다. "동시에 최대 한 모델" 불변식은 잠금과 세대 번호로 지켜지고 있으니 우회하지 않는다. 프로세스 기동·중단·스트리밍은 `engines.py`의 `Engine` 인터페이스 뒤에 둔다.
2. **파라미터 추가/변경**: `app/data/parameters.json`만 고친다. `target`으로 전달 위치를, `requires_capability`로 노출 조건을 정한다. 화면 컨트롤은 정의에서 자동 생성되므로 컴포넌트를 손대지 않는다. 모델별 차이는 `models/<id>/model.json`의 `parameter_overrides`로 처리한다.
3. **응답 처리**: 엔진 → `inference.py` → SSE → `services/api.js`로 이어지는 이벤트(`start`/`reasoning`/`delta`/`done`/`error`)를 유지한다. 비스트리밍 요청도 같은 경로를 재사용한다.
4. **화면 갱신**: 입력·슬라이더·스트리밍 텍스트는 `store.setQuiet`으로 저장한다. 지연 갱신은 실행 시점의 현재 상태를 읽어야 하며, 호출 시점 스냅샷을 들고 다니면 완료된 답변을 덮어쓰는 회귀가 재발한다.

## 검증

```sh
cd src/backend && python3 -m unittest discover -s tests -t .
sh src/frontend/tests/smoke.sh
```

동작이 바뀌면 테스트를 먼저 추가한다. 실모델 확인이 필요하면 `docs/tdd/TEST_STRATEGY.md`의 수동 검증 5단계를 따르고 결과를 `docs/runs/TASK-*/VERIFICATION.md`에 남긴다.
