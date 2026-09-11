"""Shared fixtures for the backend test suite."""

from __future__ import annotations

import json
import threading
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from app.config import APP_DIR, Config

MODEL_FIXTURES = {
    "endpoint-llm": {
        "id": "endpoint-llm",
        "name": "Endpoint LLM",
        "provider": "사내 엔드포인트",
        "provider_type": "openai",
        "parameter_profile": "vllm",
        "base_url": "http://127.0.0.1:9/v1",
        "remote_model": "endpoint-llm",
        "modality": "LLM",
        "capabilities": ["chat", "reasoning", "reasoning_effort"],
        "parameter_overrides": {"max_tokens": {"default": 512, "max": 4096}},
    },
    "vision-api": {
        "id": "vision-api",
        "name": "Vision API",
        "provider": "OpenAI",
        "provider_type": "openai",
        "base_url": "http://127.0.0.1:9/v1",
        "remote_model": "vision-api",
        "api_key_env": "TEST_API_KEY",
        "modality": "VLM",
        "capabilities": ["chat"],
        "uses_completion_tokens": True,
        "unsupported_fields": ["stop"],
    },
}


def make_models_dir(root: Path) -> Path:
    models_dir = root / "models"
    for model_id, meta in MODEL_FIXTURES.items():
        directory = models_dir / model_id
        directory.mkdir(parents=True)
        (directory / "model.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return models_dir


def point_models_at(models_dir: Path, base_url: str) -> None:
    """등록부의 base_url을 테스트용 가짜 서버로 바꾼다."""
    for meta_path in models_dir.glob("*/model.json"):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["base_url"] = base_url
        meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


def make_config(root: Path, **overrides) -> Config:
    config = Config(
        host="127.0.0.1",
        port=0,
        models_dir=make_models_dir(root),
        frontend_dir=root / "frontend",
        parameters_file=APP_DIR / "data" / "parameters.json",
        history_file=root / "var" / "history.jsonl",
        secrets_file=root / "var" / "secrets.env",
        media_dir=root / "var" / "media",
        request_timeout=5.0,
        history_limit=50,
        media_limit=10,
    )
    return replace(config, **overrides) if overrides else config


class FakeProviderServer:
    """OpenAI/Anthropic 호환 응답을 흉내내는 로컬 서버.

    공급자 어댑터를 HTTP 경계 그대로 시험하기 위해 실제 소켓을 쓴다.
    외부 API를 호출하지 않으므로 네트워크나 키가 필요 없다.
    """

    def __init__(self) -> None:
        self.requests: list[dict] = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_args):  # 테스트 출력을 더럽히지 않는다
                pass

            def do_POST(self):  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length) or b"{}")
                headers = {key.lower(): value for key, value in self.headers.items()}
                outer.requests.append({"path": self.path, "body": body, "headers": headers})
                if outer.status != 200:
                    payload = json.dumps({"error": {"message": "boom"}}).encode()
                    self.send_response(outer.status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                if not body.get("stream", True):
                    payload = json.dumps({
                        "choices": [{"message": {"role": "assistant", "content": "non-stream"}}],
                        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                    }).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                chunks = outer._anthropic() if self.path.endswith("/messages") else outer._openai()
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Connection", "close")
                self.end_headers()
                for chunk in chunks:
                    self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
                self.wfile.write(b"data: [DONE]\n\n")

        self.status = 200
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}/v1"

    @staticmethod
    def _openai() -> list[dict]:
        return [
            {"choices": [{"delta": {"reasoning_content": "생각 중"}}]},
            {"choices": [{"delta": {"content": "안녕하세요"}}]},
            {"choices": [{"delta": {"content": " 반갑습니다."}}]},
            {"choices": [{"delta": {}, "finish_reason": "stop"}],
             "usage": {"prompt_tokens": 5, "completion_tokens": 7, "total_tokens": 12}},
        ]

    @staticmethod
    def _anthropic() -> list[dict]:
        return [
            {"type": "message_start", "message": {"usage": {"input_tokens": 5}}},
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "안녕하세요"}},
            {"type": "message_delta", "usage": {"output_tokens": 7}},
            {"type": "message_stop"},
        ]

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
