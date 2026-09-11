# model_test_pc · LLM Lab 콘솔 (PC판)

모델을 서빙하지 않고 **엔드포인트를 호출만** 하는 콘솔이다. GPU도 vLLM도 필요 없다.

```text
src/
├── backend/    파이썬 표준 라이브러리 API + 정적 서버
└── frontend/   React 19 + Vite 화면
models/         호출할 엔드포인트 등록부
var/secrets.env API 키 (저장소 제외)
```

## 실행

```sh
cd src/frontend && npm install && npm run build     # 최초 1회
DEMO_MSA_LLM_API_BASE="http://<사내 엔드포인트>/v1" sh src/backend/run.sh --host 0.0.0.0
```

`http://<PC IP>:8080/`으로 접속한다. 개발 중에는 `cd src/frontend && npm run dev`(5173, `/api`는 8080으로 프록시)를 쓴다.

## 모델 등록

`models/<id>/model.json` 하나가 모델 하나다. 서버 재시작 없이 반영된다.

```json
{
  "id": "gpt-oss-120b",
  "name": "gpt-oss-120b",
  "provider": "사내 엔드포인트",
  "provider_type": "openai",
  "parameter_profile": "vllm",
  "base_url": "${DEMO_MSA_LLM_API_BASE}",
  "remote_model": "gpt-oss-120b",
  "modality": "LLM",
  "capabilities": ["chat", "reasoning", "reasoning_effort"]
}
```

| 키 | 뜻 |
| --- | --- |
| `provider_type` | 호출 규격. `openai`(OpenAI 및 호환 엔드포인트) 또는 `anthropic` |
| `parameter_profile` | 파라미터 노출 기준. 생략하면 `provider_type`과 같다. vLLM 엔드포인트는 `vllm`으로 두어 `top_k`·`min_p` 같은 확장 필드를 쓴다 |
| `base_url` | 엔드포인트 주소. `${환경변수}` 표기 가능. 값이 없으면 목록에서 제외된다 |
| `api_key_env` | 키가 필요할 때 그 **환경변수 이름**. 키 값을 여기 적지 않는다 |
| `unsupported_fields` | 그 모델이 거부하는 필드(예: 최신 GPT의 `stop`, 최신 Claude의 `temperature`) |
| `uses_completion_tokens` | `max_tokens` 대신 `max_completion_tokens`를 받는 모델 |
| `modality` | `LLM` / `VLM`. VLM만 이미지 첨부가 열린다 |

## 모델 유형

| 유형 | 실행 방식 | 등록 예 |
| --- | --- | --- |
| `LLM` / `VLM` | 프롬프트 → 채팅 응답(SSE). VLM만 이미지 첨부 | gpt-oss-120b, Claude, GPT-5.x |
| `STT` | 🎤 오디오 첨부 → 텍스트 전사 (`/audio/transcriptions`) | gpt-transcribe, whisper-1 |
| `TTS` | 문장 → 음성 파일 + 재생 (`/audio/speech`) | gpt-4o-mini-tts, tts-1-hd |
| `VIDEO` | 장면 설명 → 영상. 작업 폴링이라 분 단위 (`/videos`) | sora-2, sora-2-pro |

`model.json`의 `modality`가 유형이고, `parameter_profile`을 `stt`/`tts`/`video`로 두면 그 유형 파라미터
(language / voice·audio_format·speed / seconds·size)만 노출된다. 음성·영상은 **OpenAI 규격 엔드포인트만** 호출한다.
생성된 오디오·영상은 `var/media/`에 최신 50개(`APP_MEDIA_LIMIT`)만 남고, 기록에는 파일 URL만 들어간다.

## 첨부 문서

입력 패널의 📎로 `xlsx`·`hwp`·`hwpx`·`csv`/`txt`/`md`/`json`을 올린다. 고르는 즉시 서버가 평문으로 파싱해
칩에 글자 수를 보여주고, 실행할 때 `[첨부 문서: 파일명]` 블록으로 질문 앞에 붙는다. 파일당 3MB·문서당 12만 자,
한 번에 4개까지다. 파서는 표준 라이브러리뿐이다 — xlsx/hwpx는 zip+XML, hwp 5.0은 OLE 복합문서를 직접 읽는다.
서식·수식·이미지는 버리고 글자만 남으며, 암호가 걸린 hwp는 거부한다.

## API 키

`var/secrets.env`(권한 600)에 `KEY=VALUE`로 둔다. 서버가 기동 시 읽어 환경변수로 올리고, 오류 메시지에 섞여 나가지 않도록 마스킹한다.

```sh
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/v1/health` | 상태·등록 모델 수·키 준비 여부 |
| `GET` | `/api/v1/models?modality=` | 모델 목록 |
| `GET` | `/api/v1/parameters?model_id=` | 모델에 맞춘 파라미터 스키마 |
| `POST` | `/api/v1/generate` | 실행. 기본 SSE 스트리밍, `"stream": false`면 단일 JSON |
| `POST` | `/api/v1/runs` | 저장 버튼이 호출한다. 생성만으로는 저장되지 않는다 |
| `GET`/`DELETE` | `/api/v1/runs[/{id}]` | 기록 조회·삭제 |
| `POST` | `/api/v1/runs/compare` | 답변·파라미터 비교, 모범답변+심판 모델이면 채점 |
| `GET` | `/api/v1/judges` | 심판 후보(등록된 모든 모델) |
| `POST` | `/api/v1/documents/parse` | 첨부 문서를 평문으로 파싱. 파일은 서버에 남기지 않는다 |
| `POST` | `/api/v1/media/transcribe` | STT. 오디오 → 텍스트 |
| `POST` | `/api/v1/media/speak` | TTS. 텍스트 → 오디오 파일 |
| `POST` | `/api/v1/media/video` | 영상 생성. SSE로 진행 상황을 흘려보낸다 |
| `GET` | `/api/v1/media/files/{id}` | 생성된 오디오·영상 파일 |

`/api/v1/serving*`은 **없다.** 서빙 개념 자체가 없기 때문이다.

## 검증

```sh
cd src/backend && python3 -m unittest discover -s tests -t .   # 60건
sh src/frontend/tests/smoke.sh                                  # 12개 + 빌드
```

외부 API 없이 전부 통과한다. 공급자 어댑터는 `tests/support.py`의 가짜 서버로 실제 HTTP·SSE 경계까지 시험한다.
