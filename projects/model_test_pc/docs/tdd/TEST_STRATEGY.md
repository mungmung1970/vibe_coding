# 테스트 전략

버전: 0.1 · 2026-09-07

## 원칙

1. **외부 API를 호출하지 않는다.** 자동화 테스트는 키도 네트워크도 요구하지 않는다. 공급자 어댑터는 `tests/support.py`의 가짜 서버(`FakeProviderServer`)로 **실제 소켓과 SSE 경계까지** 시험한다. 모킹으로 어댑터를 우회하지 않는다.
2. **가짜는 테스트 코드 안에만 둔다.** 제품 코드에 대체 공급자를 만들지 않는다.
3. **결함을 고치면 회귀 테스트를 남긴다.**
4. **화면은 실제 브라우저로 확인한다.** 헤드리스 크롬의 가상 시간은 스트리밍 타이밍을 왜곡하므로 타이밍 확인에 쓰지 않는다.

## 구성

| 계층 | 위치 | 내용 |
| --- | --- | --- |
| 등록부 | `tests/test_model_registry.py` | 엔드포인트 등록, `${환경변수}` 치환, 미설정 시 제외, 프로필·키 준비 여부 |
| 공급자 | `tests/test_providers.py` | OpenAI/Anthropic 요청 변환, 헤더, 이미지 블록, 오류 구분 |
| 파라미터 | `tests/test_parameter_catalog.py` | 프로필별 노출, 검증, 버킷 분배 |
| 기록 | `tests/test_history.py` | 저장·조회·필터·비교·삭제 |
| API 통합 | `tests/test_api.py` | 실제 HTTP 서버 왕복, SSE, 저장 흐름, `/serving*` 부재 확인 |
| 프로세스 | `tests/test_shutdown.py` | SIGTERM 정상 종료 |
| 프론트 | `src/frontend/tests/` | 마크다운 이스케이프, SSE 청크 재조립, 표시 문구, 순위 계산, 빌드 |

합계: 백엔드 60건, 프론트 12개.

## 실행

```sh
cd src/backend && python3 -m unittest discover -s tests -t .
sh src/frontend/tests/smoke.sh
```

## 수동 검증 (실제 엔드포인트)

자동화하지 않는다. 주소가 닿는 PC에서 한다.

1. `APP_GPTOSS_BASE_URL`을 설정하고 기동 로그에 모델이 나타나는지 확인한다.
2. 프롬프트 1회를 실행해 지연·토큰 수·답변을 기록한다.
3. 사고 과정이 분리되는지, 파라미터가 그대로 전달되는지 확인한다.
4. 결과를 `docs/runs/TASK-*/VERIFICATION.md`에 남긴다.

## 하지 않는 것

- 외부 API 비용이 드는 회귀 시험
- 부하·동시성 시험
- 모델 출력 품질의 자동 채점
