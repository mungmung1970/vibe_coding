"""Serving engines. One process at a time, behind a single small interface."""

from __future__ import annotations

import json
import logging
import os
import shlex
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path
from typing import Iterator

from ..config import Config
from ..core.errors import ApiError
from .model_registry import Model

logger = logging.getLogger("model_test.engine")

LOG_BUFFER_LINES = 400


class Engine:
    """Interface implemented by every serving backend."""

    name = "engine"

    def __init__(self, config: Config) -> None:
        self.config = config
        self._log = deque(maxlen=LOG_BUFFER_LINES)
        self._log_lock = threading.Lock()

    @property
    def base_url(self) -> str:
        return self.config.engine_base_url

    def start(self, model: Model) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        raise NotImplementedError

    def is_alive(self) -> bool:
        raise NotImplementedError

    def probe_ready(self) -> bool:
        raise NotImplementedError

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        raise NotImplementedError

    @property
    def pid(self) -> int | None:
        return None

    def logs(self, tail: int = 200) -> list[str]:
        with self._log_lock:
            lines = list(self._log)
        return lines[-tail:] if tail > 0 else lines

    def _record(self, line: str) -> None:
        with self._log_lock:
            self._log.append(line.rstrip())

    def _clear_logs(self) -> None:
        with self._log_lock:
            self._log.clear()


def venv_python(config: Config) -> Path | None:
    """The interpreter of the side-installed vLLM environment, when there is one."""
    python = config.vllm_venv / "bin" / "python"
    return python if python.is_file() else None


def vllm_available(config: Config) -> bool:
    """vLLM counts as available in this interpreter or in the project's vLLM venv."""
    import importlib.util

    if importlib.util.find_spec("vllm") is not None:
        return True
    return any(config.vllm_venv.glob("lib/python*/site-packages/vllm/__init__.py"))


def port_in_use(host: str, port: int, timeout: float = 0.5) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(timeout)
        return probe.connect_ex((host, port)) == 0


def _iter_sse(response) -> Iterator[dict]:
    """Yield JSON payloads from an OpenAI-style ``text/event-stream`` response."""
    for raw in response:
        line = raw.decode("utf-8", errors="replace").strip()
        if not line or not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            return
        try:
            yield json.loads(data)
        except json.JSONDecodeError:
            logger.warning("dropping malformed stream chunk: %s", data[:200])


class VllmProcessEngine(Engine):
    """Runs ``vllm.entrypoints.openai.api_server`` as a supervised child process."""

    name = "vllm"

    def __init__(self, config: Config) -> None:
        super().__init__(config)
        self._process: subprocess.Popen | None = None
        self._reader: threading.Thread | None = None
        self.log_path: Path | None = None

    @property
    def pid(self) -> int | None:
        return self._process.pid if self._process and self._process.poll() is None else None

    def build_command(self, model: Model) -> list[str]:
        if self.config.vllm_command:
            command = shlex.split(self.config.vllm_command)
        else:
            python = venv_python(self.config) or Path(sys.executable)
            command = [str(python), "-m", "vllm.entrypoints.openai.api_server"]
        command += [
            "--model",
            model.serve_path,
            "--served-model-name",
            model.id,
            "--host",
            self.config.vllm_host,
            "--port",
            str(self.config.vllm_port),
        ]
        for key, value in model.engine_args.items():
            flag = f"--{str(key).strip().lstrip('-').replace('_', '-')}"
            if isinstance(value, bool):
                if value:
                    command.append(flag)
                continue
            command += [flag, str(value)]
        return command

    def start(self, model: Model) -> None:
        if self.is_alive():
            raise ApiError(409, "engine_busy", "이미 실행 중인 서빙 프로세스가 있습니다.")
        if port_in_use(self.config.vllm_host, self.config.vllm_port):
            raise ApiError(
                409,
                "port_in_use",
                f"{self.config.vllm_host}:{self.config.vllm_port} 포트를 다른 프로세스가 사용 중입니다.",
            )
        self._clear_logs()
        self.config.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_path = self.config.log_dir / f"vllm-{model.id}-{time.strftime('%Y%m%d-%H%M%S')}.log"
        command = self.build_command(model)
        self._record(f"$ {' '.join(command)}")
        logger.info("starting vLLM: %s", " ".join(command))
        try:
            self._process = subprocess.Popen(  # noqa: S603 - command is built from local config
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
        except OSError as exc:
            raise ApiError(500, "engine_start_failed", f"서빙 프로세스를 시작하지 못했습니다: {exc}") from exc
        self._reader = threading.Thread(target=self._drain, args=(self._process, self.log_path), daemon=True)
        self._reader.start()

    def _drain(self, process: subprocess.Popen, log_path: Path) -> None:
        assert process.stdout is not None
        with log_path.open("a", encoding="utf-8") as sink:
            for raw in process.stdout:
                line = raw.decode("utf-8", errors="replace")
                sink.write(line)
                sink.flush()
                self._record(line)

    def stop(self) -> None:
        process = self._process
        self._process = None
        if process is None or process.poll() is not None:
            return
        self._record("서빙 프로세스 종료를 요청했습니다.")
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            process.terminate()
        try:
            process.wait(timeout=self.config.shutdown_timeout)
        except subprocess.TimeoutExpired:
            self._record("정상 종료 시간이 지나 SIGKILL로 강제 종료합니다.")
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                process.kill()
            process.wait(timeout=self.config.shutdown_timeout)

    def is_alive(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def exit_code(self) -> int | None:
        return self._process.poll() if self._process else None

    def probe_ready(self) -> bool:
        try:
            with urllib.request.urlopen(f"{self.base_url}/health", timeout=2) as response:
                return 200 <= response.status < 300
        except (urllib.error.URLError, TimeoutError, OSError):
            return False

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        request = urllib.request.Request(
            f"{self.base_url}/v1/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.config.request_timeout) as response:
                yield from _iter_sse(response)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise ApiError(502, "engine_error", f"서빙 엔진이 요청을 거부했습니다: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ApiError(504, "engine_unreachable", f"서빙 엔진에 연결할 수 없습니다: {exc}") from exc


class RemoteApiEngine(Engine):
    """외부 API 모델용 엔진. 띄울 프로세스가 없으므로 선택 즉시 준비 상태다."""

    name = "remote"

    OPENAI_URL = "https://api.openai.com/v1/chat/completions"
    ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
    ANTHROPIC_VERSION = "2023-06-01"

    # 공급자가 실제로 받는 필드만 통과시킨다. vLLM 확장 필드는 그대로 보내면 400이 난다.
    # 최신 모델 기준 실제 허용 필드. gpt-5 계열은 stop을, claude 최신 계열은 샘플링 파라미터를 거부한다.
    OPENAI_FIELDS = {"temperature", "top_p", "max_tokens", "n", "seed",
                     "frequency_penalty", "presence_penalty", "logprobs", "top_logprobs"}
    ANTHROPIC_FIELDS = {"max_tokens", "stop"}

    def __init__(self, config: Config) -> None:
        super().__init__(config)
        self._model: Model | None = None

    @property
    def base_url(self) -> str:
        return self.OPENAI_URL if (self._model and self._model.provider_type == "openai") else self.ANTHROPIC_URL

    def start(self, model: Model) -> None:
        from .secrets import get_secret, mask

        key = get_secret(model.api_key_env)
        if not key:
            raise ApiError(
                400,
                "api_key_missing",
                f"'{model.id}' 모델에 필요한 API 키({model.api_key_env})가 설정되어 있지 않습니다.",
            )
        self._clear_logs()
        self._model = model
        self._record(f"[remote] {model.provider} '{model.remote_model or model.id}' 선택 (키 {mask(key)})")

    def stop(self) -> None:
        if self._model is not None:
            self._record(f"[remote] '{self._model.id}' 선택을 해제했습니다.")
        self._model = None

    def is_alive(self) -> bool:
        return self._model is not None

    def probe_ready(self) -> bool:
        return self.is_alive()

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        model = self._model
        if model is None:
            raise ApiError(409, "engine_not_ready", "선택된 원격 모델이 없습니다.")
        if model.provider_type == "anthropic":
            yield from self._anthropic_stream(model, payload)
        else:
            yield from self._openai_stream(model, payload)

    def _request(self, url: str, body: dict, headers: dict) -> Iterator[bytes]:
        from .secrets import scrub

        request = urllib.request.Request(
            url,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "text/event-stream", **headers},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.config.request_timeout) as response:
                yield from response
        except urllib.error.HTTPError as exc:
            detail = scrub(exc.read().decode("utf-8", errors="replace")[:500])
            raise ApiError(502, "remote_api_error", f"외부 API가 요청을 거부했습니다: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ApiError(504, "remote_unreachable", f"외부 API에 연결할 수 없습니다: {exc}") from exc

    def _openai_stream(self, model: Model, payload: dict) -> Iterator[dict]:
        from .secrets import get_secret

        body = {key: value for key, value in payload.items() if key in self.OPENAI_FIELDS}
        # 최신 OpenAI 모델은 max_tokens 대신 max_completion_tokens를 받는다.
        if "max_tokens" in body:
            body["max_completion_tokens"] = body.pop("max_tokens")
        body.update({
            "model": model.remote_model or model.id,
            "messages": payload["messages"],
            "stream": True,
            "stream_options": {"include_usage": True},
        })
        if payload.get("chat_template_kwargs", {}).get("reasoning_effort"):
            body["reasoning_effort"] = payload["chat_template_kwargs"]["reasoning_effort"]
        headers = {"Authorization": f"Bearer {get_secret(model.api_key_env)}"}
        yield from _iter_sse(self._request(self.OPENAI_URL, body, headers))

    def _anthropic_stream(self, model: Model, payload: dict) -> Iterator[dict]:
        from .secrets import get_secret

        messages = [self._to_anthropic_message(message) for message in payload["messages"]
                    if message.get("role") != "system"]
        system = " ".join(
            str(message.get("content", "")) for message in payload["messages"] if message.get("role") == "system"
        )
        body = {key: value for key, value in payload.items() if key in self.ANTHROPIC_FIELDS}
        body.update({
            "model": model.remote_model or model.id,
            "messages": messages,
            "stream": True,
            "max_tokens": int(payload.get("max_tokens") or 4096),
        })
        if system.strip():
            body["system"] = system
        if "stop" in body:
            body["stop_sequences"] = body.pop("stop")
        headers = {"x-api-key": get_secret(model.api_key_env) or "", "anthropic-version": self.ANTHROPIC_VERSION}
        yield from self._translate_anthropic(self._request(self.ANTHROPIC_URL, body, headers))

    @staticmethod
    def _to_anthropic_message(message: dict) -> dict:
        """OpenAI 형식의 content 배열을 Anthropic 블록으로 바꾼다(이미지 포함)."""
        content = message.get("content")
        if not isinstance(content, list):
            return message
        blocks = []
        for item in content:
            if item.get("type") == "text":
                blocks.append({"type": "text", "text": item.get("text", "")})
                continue
            url = (item.get("image_url") or {}).get("url", "")
            if not url.startswith("data:"):
                continue
            header, _, data = url.partition(",")
            media_type = header[5:].split(";")[0] or "image/png"
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}})
        return {"role": message.get("role", "user"), "content": blocks}

    @staticmethod
    def _translate_anthropic(lines: Iterator[bytes]) -> Iterator[dict]:
        """Anthropic 스트림을 OpenAI 청크 모양으로 바꿔 상위 계층을 하나로 유지한다."""
        usage: dict[str, int] = {}
        for raw in lines:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                event = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            kind = event.get("type")
            if kind == "content_block_delta":
                delta = event.get("delta") or {}
                if delta.get("type") == "thinking_delta":
                    yield {"choices": [{"delta": {"reasoning_content": delta.get("thinking", "")}}]}
                elif delta.get("text"):
                    yield {"choices": [{"delta": {"content": delta["text"]}}]}
            elif kind == "message_start":
                counts = (event.get("message") or {}).get("usage") or {}
                usage["prompt_tokens"] = counts.get("input_tokens", 0)
            elif kind == "message_delta":
                counts = event.get("usage") or {}
                usage["completion_tokens"] = counts.get("output_tokens", 0)
            elif kind == "message_stop":
                usage["total_tokens"] = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)
                yield {"choices": [{"delta": {}, "finish_reason": "stop"}], "usage": usage}
            elif kind == "error":
                message = (event.get("error") or {}).get("message", "알 수 없는 오류")
                raise ApiError(502, "remote_api_error", f"외부 API 오류: {message}")


def create_engine(config: Config) -> Engine:
    """Build the serving engine, refusing to start rather than faking answers."""
    choice = config.engine
    if choice not in {"auto", "vllm"}:
        raise ApiError(500, "invalid_engine", f"알 수 없는 엔진 설정입니다: {choice}")
    if choice == "vllm" or vllm_available(config):
        return VllmProcessEngine(config)
    raise ApiError(
        500,
        "vllm_missing",
        f"vLLM을 찾을 수 없습니다. {config.vllm_venv}에 설치하거나 "
        "MODEL_TEST_VLLM_VENV/MODEL_TEST_VLLM_COMMAND로 경로를 지정해 주세요.",
    )
