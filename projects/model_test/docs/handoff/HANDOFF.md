# HANDOFF

갱신일: 2026-09-07

작업 완료 시 공통 [Loop Engineering](../../../../harness/docs/LOOP_ENGINEERING.md) 절차에 따라 검증 통과 후에만 commit/push한다.

## 지금 상태

| 항목 | 값 |
| --- | --- |
| 콘솔 | `sh src/backend/run.sh --host 0.0.0.0`로 상시 실행 중, `http://<서버IP>:8080` |
| 엔진 | vLLM 0.28.0 (`.venv-vllm`, torch 2.13.0+cu130), GPU B200 1장 |
| 등록 모델 | 9종: 로컬 5종 + OpenAI/Anthropic 원격 4종(`models/README.md`) |
| 테스트 | 백엔드 42건, 프론트 테스트 12개 및 Vite 빌드 통과 |
| 완료 작업 | TASK-001(콘솔 구축) · TASK-002(사고 진행 표시) · TASK-003(문서/기동 재시도) · TASK-004(잔여 모델 검증) |

## 바로 알아야 할 것

1. **모델은 한 번에 하나만 서빙된다.** 화면에서 다른 모델을 고르면 기존 프로세스를 정리한 뒤 새로 띄운다. 기동은 3~13분이 걸리므로 예열된 모델을 이유 없이 바꾸지 않는 편이 좋다.
2. **파라미터는 `src/backend/app/data/parameters.json` 한 곳에서 관리한다.** 항목을 추가하면 화면 컨트롤과 요청 전달, 검증이 함께 따라온다. `target`이 전달 위치(`body`/`extra_body`/`chat_template_kwargs`/`client`)를 결정한다.
3. **모델 추가는 `models/<id>/model.json` 생성만으로 끝난다.** 서버 재시작이 필요 없다. 가중치는 공유 스토리지를 `path`로 가리킨다.
4. **대체 엔진이 없다.** vLLM을 찾지 못하면 서버가 기동을 거부한다. 가짜 응답이 실제 응답으로 오인되는 사고를 막기 위한 의도적 설계다(ADR-0001).
5. **프론트는 React + Vite다.** 소스를 고친 뒤 `cd src/frontend && npm run build`를 실행해야 백엔드가 새 화면을 서빙한다. 개발 중에는 `npm run dev`를 사용할 수 있다.

## 자주 하는 작업

```sh
# 콘솔 실행 / 원격 접속 허용
sh src/backend/run.sh --host 0.0.0.0

# 테스트
cd src/backend && python3 -m unittest discover -s tests -t .
sh src/frontend/tests/smoke.sh

# 서빙 상태와 엔진 로그
curl -s localhost:8080/api/v1/serving
curl -s "localhost:8080/api/v1/serving/logs?tail=50"

# 모델 교체(화면에서도 가능)
curl -s -X POST localhost:8080/api/v1/serving -H 'Content-Type: application/json' -d '{"model_id":"qwen3.8-27b"}'
```

## 알려진 한계

- 인증이 없다. `--host 0.0.0.0`은 신뢰 가능한 사내망에서만 쓴다.
- 검증자가 구현자와 동일하다. 하니스 규약의 독립 검증을 충족하려면 별도 담당이 필요하다.
- 부하·동시 요청·장시간 안정성은 확인하지 않았다.
- 답변 비교는 파라미터 차이와 나란히 보기, 모범답변·심판 모델을 이용한 선택적 점수/순위 표시를 제공한다.
- 최초 기동은 커널 캐시가 비어 있어 훨씬 오래 걸리고, 과거 한 번 그 구간에서 프로세스가 죽은 적이 있다. 재시도로 해소되었으며 재발 시 종료 코드가 상태 메시지에 표시된다.

## 다음에 하면 좋을 것

- `docs/adr/`에 파라미터 카탈로그 설계(ADR-0002) 기록
- 결과 조회 화면의 대량 기록 대비(현재 최근 500건 보관, 조회 60건 제한)
- 모델별 기동 시간을 등록부에 캐시해 화면에 예상 대기 시간 표시
