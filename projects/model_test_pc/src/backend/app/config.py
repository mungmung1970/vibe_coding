"""Runtime configuration resolved from environment variables.

이 프로젝트는 모델을 직접 서빙하지 않는다. 따라서 vLLM·프로세스 수명주기 관련
설정이 없고, 필요한 것은 정적 파일 경로와 외부 호출 타임아웃뿐이다.
"""

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
    secrets_file: Path
    request_timeout: float
    history_limit: int

    @classmethod
    def from_env(cls) -> "Config":
        var_dir = _env_path("APP_VAR_DIR", PROJECT_ROOT / "var")
        return cls(
            host=os.environ.get("APP_HOST", "127.0.0.1"),
            port=_env_int("APP_PORT", 8080),
            models_dir=_env_path("APP_MODELS_DIR", PROJECT_ROOT / "models"),
            frontend_dir=_env_path("APP_FRONTEND_DIR", _frontend_dir()),
            parameters_file=_env_path("APP_PARAMETERS_FILE", APP_DIR / "data" / "parameters.json"),
            history_file=_env_path("APP_HISTORY_FILE", var_dir / "history.jsonl"),
            secrets_file=_env_path("APP_SECRETS_FILE", var_dir / "secrets.env"),
            request_timeout=_env_float("APP_REQUEST_TIMEOUT", 600.0),
            history_limit=_env_int("APP_HISTORY_LIMIT", 500),
        )
