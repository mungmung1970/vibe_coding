# TASK-001 · EXECUTION — 모델 테스트 콘솔 구축

기간: 2026-09-04 ~ 2026-09-07 (**기록은 소급 정리**)

## 산출물

```text
src/backend/           파이썬 표준 라이브러리 API + 정적 서버
  app/core/            HTTP 원시 계층(라우터, JSON, SSE 청크 전송, 정적 파일)
  app/services/        model_registry / parameter_catalog / engines / serving_manager / inference / history
  app/api/routes.py    /api/v1 경로 연결
  app/data/parameters.json  파라미터 카탈로그 19항목
  tests/               37건
src/frontend/          빌드 없는 ES 모듈 화면
  src/components/      layout / sidebar / controls / prompt-view / history-view / button
  src/state/           store(조용한 갱신 포함) / actions
  src/services/api.js  유일한 fetch 지점(SSE 파서 포함)
  tests/               13건
models/                모델 등록부(가중치는 외부 스토리지 참조)
```

## 주요 구현

- **단일 서빙 불변식**: `serving_manager.py`가 잠금과 세대(generation) 번호로 전환을 직렬화한다. 새 모델 요청 시 기존 프로세스를 SIGTERM → (유예 후) SIGKILL로 정리한 뒤 시작하고, 백그라운드 감시 스레드가 `/health`로 준비 여부를 확인한다.
- **파라미터 카탈로그**: 19항목을 `target`(`body`/`extra_body`/`chat_template_kwargs`/`client`)으로 분류하고, 모델 `capabilities`로 노출을 제어한다. 서버는 들어온 값을 범위·타입·선택지로 검증한 뒤 각 자리로 나눠 담는다.
- **스트리밍**: 엔진 → 서비스 → SSE(청크 전송) → 브라우저 `fetch` 스트림 파서까지 하나의 이벤트 흐름(`start`/`reasoning`/`delta`/`done`/`error`)으로 통일했다. 비스트리밍 요청도 같은 코드 경로를 재사용한다.
- **화면 갱신**: 입력·슬라이더·스트리밍 텍스트는 `store.setQuiet`으로 저장해 타이핑 중 리렌더가 끼어들지 않게 했다.

## 구현 중 발견해 고친 결함

| 결함 | 영향 | 조치 |
| --- | --- | --- |
| 시그널 핸들러가 `serve_forever`와 같은 스레드에서 `shutdown()` 호출 | Ctrl+C·SIGTERM으로 서버가 종료되지 않고 정지 | 별도 스레드에서 종료 요청, 회귀 테스트 추가 |
| 스트리밍 화면 갱신이 과거 스냅샷을 들고 지연 실행 | 답변 완료 후 화면이 "생성 중"으로 되돌아가 응답이 보이지 않음 | 지연 호출이 현재 상태를 읽도록 변경, 회귀 테스트 2건 |
| 가중치 유무를 등록부 디렉터리에서만 확인 | 실제 가중치가 있어도 전부 `has_weights=false` | `path` 대상 디렉터리를 확인하도록 수정, 테스트 추가 |

## 환경 정비

- vLLM 0.28.0을 `.venv-vllm`에 격리 설치(컨테이너의 NVIDIA torch 보호). `engine=auto`가 이 venv도 탐색하도록 처리.
- 초기에 두었던 mock 엔진은 실제 엔진 도입 후 제거했다. 가짜 답변이 실제 응답으로 오인되는 사고가 있었기 때문이며, 테스트 대역은 `tests/support.py`의 `StubEngine`으로 옮겼다.
- 등록부를 실제 로컬 가중치(`/NHNHOME/WORKSPACE/26mss001_H0/models`)로 연결하고, 이후 Qwen3.6 → Qwen3.8로 교체했다.
