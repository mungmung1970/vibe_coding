---
name: model-test-deploy
description: Use when running, restarting, or troubleshooting the model_test console and its vLLM serving environment.
---

# 콘솔 실행과 운영

## 언제 쓰나

콘솔을 띄우거나 재시작할 때, 원격 접속·서빙 실패·엔진 환경 문제를 다룰 때.

## 실행

```sh
sh src/backend/run.sh                 # 이 장비에서만 접속 (127.0.0.1:8080)
sh src/backend/run.sh --host 0.0.0.0  # 다른 PC에서 접속 (http://<서버IP>:8080)
```

백엔드가 `src/frontend`를 정적으로 서빙한다. 빌드 단계가 없고, `index.html`을 `file://`로 직접 열면 동작하지 않는다.

## 서빙 엔진

vLLM은 `.venv-vllm`에 격리 설치되어 있다. 실행 환경의 NVIDIA torch 빌드를 보호하기 위한 것이므로 시스템 파이썬에 vLLM을 설치하지 않는다.

```sh
python3 -m venv .venv-vllm && .venv-vllm/bin/python -m pip install vllm   # 최초 1회
```

`engine=auto`가 `.venv-vllm`을 탐색한다. 위치를 바꾸려면 `MODEL_TEST_VLLM_VENV`, 기동 명령 자체를 바꾸려면 `MODEL_TEST_VLLM_COMMAND`.

## 문제 해결

| 증상 | 확인 |
| --- | --- |
| 페이지가 안 열림 | 콘솔이 떠 있는지(`pgrep -f "python3 -m app.main"`), 원격이면 `--host 0.0.0.0`인지 |
| 기동 거부 | vLLM을 못 찾은 경우다. `.venv-vllm` 존재 확인 |
| 서빙이 `error` | 상태 메시지의 종료 코드와 `GET /api/v1/serving/logs?tail=200`, `var/logs/vllm-*.log` |
| 기동이 오래 걸림 | 정상이다. 캐시가 찬 뒤 27B급 약 2~3분, 120B MXFP4 약 12분. 한도는 `MODEL_TEST_STARTUP_TIMEOUT`(기본 1800초) |
| 화면 변경이 반영 안 됨 | 브라우저 강력 새로고침(Ctrl+Shift+R) |

## 주의

- 모델 전환은 기존 서빙을 중단시킨다. 예열된 모델을 이유 없이 바꾸지 않는다.
- 인증이 없다. `--host 0.0.0.0`은 신뢰 가능한 사내망에서만 사용한다.
- 서버 종료는 SIGTERM/Ctrl+C로 충분하며, 서빙 중이던 모델까지 함께 정리된다.
