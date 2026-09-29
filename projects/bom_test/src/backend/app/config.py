"""환경변수로 결정되는 런타임 설정.

모델은 gpt-oss-120b 하나뿐이라 등록부를 두지 않는다. 엔드포인트 세 값
(`DEMO_MSA_LLM_API_BASE` / `_MODEL` / `_API_KEY`)을 `var/secrets.env`에서 읽는다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
SRC_DIR = APP_DIR.parent.parent
PROJECT_ROOT = SRC_DIR.parent


def _env_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default


def _env_num(name: str, default, cast):
    try:
        return cast(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    frontend_dir: Path
    secrets_file: Path
    request_timeout: float

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            host=os.environ.get("APP_HOST", "127.0.0.1"),
            port=_env_num("APP_PORT", 8090, int),
            frontend_dir=_env_path("APP_FRONTEND_DIR", SRC_DIR / "frontend"),
            secrets_file=_env_path("APP_SECRETS_FILE", PROJECT_ROOT / "var" / "secrets.env"),
            request_timeout=_env_num("APP_REQUEST_TIMEOUT", 600.0, float),
        )
