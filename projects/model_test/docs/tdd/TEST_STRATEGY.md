# 테스트 전략

버전: 0.2 · 2026-09-07

## 원칙

1. **GPU 없이 전부 돈다.** 자동화 테스트는 모델 가중치나 GPU를 요구하지 않는다. 엔진 인터페이스에 테스트 대역(`tests/support.py::StubEngine`)을 끼워 API 전체를 왕복시킨다. 실모델 확인은 수동 검증 절차로 분리한다.
2. **가짜는 테스트 코드 안에만 둔다.** 제품 코드에 대체 엔진을 두지 않는다. 실행 환경에서 가짜 응답이 실제 응답으로 오인된 사고가 있었다.
3. **결함을 고치면 회귀 테스트를 남긴다.** 아래 "회귀 목록"의 항목은 모두 실제로 발생했던 장애다.
4. **화면은 실제 브라우저로 확인한다.** 헤드리스 크롬의 가상 시간(`--virtual-time-budget`)은 스트리밍 타이밍을 왜곡하므로, 타이밍이 걸린 확인은 CDP 실시간 구동으로만 한다.

## 구성

| 계층 | 위치 | 건수 | 내용 |
| --- | --- | --- | --- |
| 백엔드 단위 | `src/backend/tests/test_model_registry.py`, `test_parameter_catalog.py`, `test_history.py` | — | 등록부 스캔·가중치 탐지, 파라미터 검증과 버킷 분배, 기록 조회·비교 |
| 백엔드 서비스 | `src/backend/tests/test_serving_manager.py` | — | 단일 서빙 불변식, 상태 전이, vLLM 명령 조립, venv 탐지 |
| 백엔드 통합 | `src/backend/tests/test_api.py` | — | 실제 HTTP 서버를 띄워 SSE 스트리밍까지 왕복 |
| 프로세스 수명 | `src/backend/tests/test_shutdown.py` | — | 서버를 자식 프로세스로 띄우고 SIGTERM 종료 확인 |
| 프론트 단위 | `src/frontend/tests/unit.test.js`, `api.test.js` | — | 마크다운 렌더·이스케이프, 스토어, SSE 청크 재조립, 표시 문구 |
| 프론트 정적 | `src/frontend/tests/smoke.sh` | — | 모든 모듈 `node --check` |
| 합계 | 백엔드 42건 · 프론트 테스트 12개 | | |

## 실행

```sh
cd src/backend && python3 -m unittest discover -s tests -t .
sh src/frontend/tests/smoke.sh
```

의존성 설치가 필요 없다. 두 명령 모두 수 초 안에 끝난다.

## 회귀 목록 (실제 장애에서 유래)

| 장애 | 테스트 |
| --- | --- |
| 시그널 핸들러가 같은 스레드에서 `shutdown()`을 호출해 서버가 종료되지 않음 | `test_shutdown.py::test_sigterm_stops_the_server` |
| 스트리밍 화면 갱신이 과거 스냅샷을 덮어써 답변이 사라짐 | `unit.test.js` 스로틀 2건 |
| 가중치 유무를 등록부 디렉터리에서만 확인해 항상 거짓 | `test_model_registry.py::test_weights_are_detected_where_path_points` |
| vLLM 미설치 시 조용히 가짜 답변 | `test_serving_manager.py::test_side_installed_venv_is_used_and_detected` |

## 수동 검증 (실모델)

자동화하지 않는다. GPU와 수 분의 기동 시간이 필요하고 결과가 모델에 따라 달라진다. 대신 절차를 고정한다.

1. 대상 모델을 서빙하고 `ready` 도달 시간을 기록한다.
2. 프롬프트 1회를 실행해 지연·토큰 수·답변을 기록한다.
3. 추론 파서가 설정된 모델은 사고 스트림이 본문과 분리되는지 확인한다.
4. 파라미터 노출이 모델 능력과 일치하는지 `/api/v1/parameters`로 확인한다.
5. 결과를 해당 작업의 `docs/runs/TASK-*/VERIFICATION.md`에 남긴다.

## 하지 않는 것

- 부하·동시성·장시간 안정성 시험
- 장시간·대규모 모델 출력 품질 평가
- 브라우저 호환성 매트릭스(크롬 계열만 확인)
