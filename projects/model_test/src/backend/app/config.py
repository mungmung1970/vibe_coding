"""Runtime configuration resolved from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
SRC_DIR = BACKEND_DIR.parent
PROJECT_ROOT = SRC_DIR.parent


def _env_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _frontend_dir() -> Path:
    """빌드 산출물이 있으면 그쪽을, 없으면 소스 디렉터리를 서빙한다."""
    built = SRC_DIR / "frontend" / "dist"
    return built if (built / "index.html").is_file() else SRC_DIR / "frontend"


@dataclass(frozen=True)
class Config:
    """Everything the server needs to know about its surroundings."""

    host: str
    port: int
    models_dir: Path
    frontend_dir: Path
    parameters_file: Path
    history_file: Path
    log_dir: Path
    secrets_file: Path
    engine: str
    vllm_host: str
    vllm_port: int
    vllm_command: str
    vllm_venv: Path
    startup_timeout: float
    shutdown_timeout: float
    request_timeout: float
    history_limit: int

    @property
    def engine_base_url(self) -> str:
        return f"http://{self.vllm_host}:{self.vllm_port}"

    @classmethod
    def from_env(cls) -> "Config":
        var_dir = _env_path("MODEL_TEST_VAR_DIR", PROJECT_ROOT / "var")
        return cls(
            host=os.environ.get("MODEL_TEST_HOST", "127.0.0.1"),
            port=_env_int("MODEL_TEST_PORT", 8080),
            models_dir=_env_path("MODEL_TEST_MODELS_DIR", PROJECT_ROOT / "models"),
            frontend_dir=_env_path("MODEL_TEST_FRONTEND_DIR", _frontend_dir()),
            parameters_file=_env_path("MODEL_TEST_PARAMETERS_FILE", APP_DIR / "data" / "parameters.json"),
            history_file=_env_path("MODEL_TEST_HISTORY_FILE", var_dir / "history.jsonl"),
            secrets_file=_env_path("MODEL_TEST_SECRETS_FILE", var_dir / "secrets.env"),
            log_dir=_env_path("MODEL_TEST_LOG_DIR", var_dir / "logs"),
            engine=os.environ.get("MODEL_TEST_ENGINE", "auto").lower(),
            vllm_host=os.environ.get("MODEL_TEST_VLLM_HOST", "127.0.0.1"),
            vllm_port=_env_int("MODEL_TEST_VLLM_PORT", 8000),
            vllm_command=os.environ.get("MODEL_TEST_VLLM_COMMAND", ""),
            vllm_venv=_env_path("MODEL_TEST_VLLM_VENV", PROJECT_ROOT / ".venv-vllm"),
            # Cold starts also compile/fetch kernels, not just load weights.
            startup_timeout=_env_float("MODEL_TEST_STARTUP_TIMEOUT", 1800.0),
            shutdown_timeout=_env_float("MODEL_TEST_SHUTDOWN_TIMEOUT", 30.0),
            request_timeout=_env_float("MODEL_TEST_REQUEST_TIMEOUT", 600.0),
            history_limit=_env_int("MODEL_TEST_HISTORY_LIMIT", 500),
        )
