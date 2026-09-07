"""Shared fixtures for the backend test suite."""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import Iterator

from app.config import APP_DIR, Config
from app.core.errors import ApiError
from app.services.engines import Engine
from app.services.model_registry import Model

MODEL_FIXTURES = {
    "reasoner": {
        "id": "reasoner",
        "name": "Reasoner",
        "provider": "Local",
        "capabilities": ["chat", "reasoning", "reasoning_effort"],
        "hf_id": "acme/reasoner",
        "engine_args": {"max-model-len": 4096, "trust-remote-code": True},
        "parameter_overrides": {"max_tokens": {"default": 512, "max": 4096}},
    },
    "plain": {
        "id": "plain",
        "name": "Plain",
        "provider": "Local",
        "capabilities": ["chat"],
        "hf_id": "acme/plain",
    },
}


class StubEngine(Engine):
    """In-process stand-in for vLLM so the API can be tested without a GPU."""

    name = "stub"

    def __init__(self, config: Config) -> None:
        super().__init__(config)
        self._model: Model | None = None

    def start(self, model: Model) -> None:
        self._clear_logs()
        self._model = model
        self._record(f"[stub] '{model.id}' 서빙을 시작합니다.")

    def stop(self) -> None:
        if self._model is not None:
            self._record(f"[stub] '{self._model.id}' 서빙을 중단했습니다.")
        self._model = None

    def is_alive(self) -> bool:
        return self._model is not None

    def probe_ready(self) -> bool:
        return self.is_alive()

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        if not self.is_alive():
            raise ApiError(409, "engine_not_ready", "서빙 중인 모델이 없습니다.")
        prompt = next(
            (str(message.get("content", "")) for message in reversed(payload.get("messages", []))
             if message.get("role") == "user"),
            "",
        )
        if payload.get("chat_template_kwargs", {}).get("reasoning_effort"):
            yield {"choices": [{"delta": {"reasoning_content": "질문을 확인한다."}, "finish_reason": None}]}
        for piece in (f"## {prompt}\n\n", "LCA 리포트는 생애주기 평가 결과를 ", "정리한 보고서입니다.\n"):
            yield {"choices": [{"delta": {"content": piece}, "finish_reason": None}]}
        yield {
            "choices": [{"delta": {}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 30, "total_tokens": 42},
        }


def make_models_dir(root: Path) -> Path:
    models_dir = root / "models"
    for model_id, meta in MODEL_FIXTURES.items():
        directory = models_dir / model_id
        directory.mkdir(parents=True)
        (directory / "model.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return models_dir


def make_config(root: Path, **overrides) -> Config:
    config = Config(
        host="127.0.0.1",
        port=0,
        models_dir=make_models_dir(root),
        frontend_dir=root / "frontend",
        parameters_file=APP_DIR / "data" / "parameters.json",
        history_file=root / "var" / "history.jsonl",
        secrets_file=root / "var" / "secrets.env",
        log_dir=root / "var" / "logs",
        engine="auto",
        vllm_host="127.0.0.1",
        vllm_port=8000,
        vllm_command="",
        vllm_venv=root / ".venv-vllm",
        startup_timeout=5.0,
        shutdown_timeout=2.0,
        request_timeout=10.0,
        history_limit=50,
    )
    return replace(config, **overrides) if overrides else config
