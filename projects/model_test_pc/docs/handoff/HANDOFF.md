# HANDOFF

갱신일: 2026-09-07

## 지금 상태

| 항목 | 값 |
| --- | --- |
| 실행 | `APP_PORT=8090`으로 이 GPU 서버에서 시험 가동 중 |
| 등록 모델 | 5종 — 사내 gpt-oss 엔드포인트 1, OpenAI 2, Anthropic 2 |
| 검증 | 백엔드 41건, 프론트 12개 + 빌드. 외부 API 실호출 성공 |
| 미검증 | 사내 엔드포인트 실호출(이 서버에서 접속 불가) |

## 바로 알아야 할 것

1. **서빙이 없다.** 모델 선택은 즉시 반영되고 GPU를 쓰지 않는다. 서빙 관련 코드를 되살리지 않는다(ADR-0001).
2. **엔드포인트 주소는 환경변수로 넣는다.** `DEMO_MSA_LLM_API_BASE`가 없으면 그 모델은 목록에서 빠진다.
3. **파라미터 프로필**이 노출을 결정한다. vLLM 엔드포인트는 `vllm`, 외부 API는 `openai`/`anthropic`.
4. **키는 `var/secrets.env`에만.** 등록부에는 환경변수 이름만 적는다.
5. **화면 수정 후 `npm run build`** 를 해야 백엔드가 서빙하는 화면에 반영된다.

작업 완료 시 공통 [Loop Engineering](../../../../harness/docs/LOOP_ENGINEERING.md) 절차에 따라 검증 통과 후에만 commit/push한다.

## 자주 하는 작업

```sh
DEMO_MSA_LLM_API_BASE="http://<주소>/v1" sh src/backend/run.sh --host 0.0.0.0
curl -s localhost:8080/api/v1/models | python3 -m json.tool
cd src/backend && python3 -m unittest discover -s tests -t .
```

## 알려진 한계

- 인증이 없다. 신뢰 가능한 망에서만 연다.
- 엔드포인트가 죽으면 오류를 정확히 알리는 것 외에 할 수 있는 일이 없다.
- 공급자별 파라미터 지원은 현재 모델 기준이다. 다른 모델은 `unsupported_fields`로 조정한다.
