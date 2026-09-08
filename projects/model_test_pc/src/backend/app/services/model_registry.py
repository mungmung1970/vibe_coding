"""호출 가능한 모델 등록부. 가중치나 서빙 프로세스는 다루지 않는다."""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ..core.errors import ApiError

logger = logging.getLogger("app.registry")

METADATA_FILE = "model.json"
PROVIDER_TYPES = ("openai", "anthropic")


@dataclass(frozen=True)
class Model:
    """엔드포인트 하나에 대한 호출 정보."""

    id: str
    name: str
    provider: str
    provider_type: str
    base_url: str
    remote_model: str
    api_key_env: str = ""
    description: str = ""
    modality: str = "LLM"
    capabilities: tuple[str, ...] = ("chat",)
    context_length: int | None = None
    parameter_profile: str = ""
    unsupported_fields: tuple[str, ...] = ()
    uses_completion_tokens: bool = False
    parameter_overrides: dict[str, Any] = field(default_factory=dict)
    directory: str = ""

    @property
    def label(self) -> str:
        """UI 표시용 이름. 모델 유형을 괄호로 덧붙인다."""
        return f"{self.name} ({self.modality})"

    @property
    def profile(self) -> str:
        """파라미터 노출 기준. 같은 OpenAI 규격이라도 vLLM 엔드포인트는 확장 필드를 받는다."""
        return self.parameter_profile or self.provider_type

    @property
    def needs_key(self) -> bool:
        return bool(self.api_key_env)

    @property
    def key_ready(self) -> bool:
        return not self.needs_key or bool(os.environ.get(self.api_key_env))

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["capabilities"] = list(self.capabilities)
        payload["unsupported_fields"] = list(self.unsupported_fields)
        payload["label"] = self.label
        payload["key_ready"] = self.key_ready
        return payload


def _read_json(path: Path) -> dict:
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("skipping unreadable metadata %s: %s", path, exc)
        return {}
    return data if isinstance(data, dict) else {}


def _expand(value: str) -> str:
    """``${APP_GPTOSS_BASE_URL}`` 같은 표기를 환경변수로 치환한다.

    변수가 설정되지 않아 치환되지 않으면 주소가 없는 것으로 취급한다.
    그대로 두면 호출할 수 없는 주소로 목록에 나타난다.
    """
    expanded = os.path.expandvars(value).strip()
    if "${" in expanded or expanded.startswith("$"):
        logger.warning("environment variable in base_url is not set: %s", value)
        return ""
    return expanded


def build_model(directory: Path) -> Model | None:
    meta_path = directory / METADATA_FILE
    if not meta_path.is_file():
        return None
    meta = _read_json(meta_path)
    if not meta:
        return None

    provider_type = str(meta.get("provider_type") or "openai").lower()
    if provider_type not in PROVIDER_TYPES:
        logger.warning("unknown provider_type '%s' in %s", provider_type, directory)
        return None

    base_url = _expand(str(meta.get("base_url") or "")).rstrip("/")
    if not base_url:
        logger.warning("model '%s' has no base_url; skipping", directory.name)
        return None

    capabilities = meta.get("capabilities")
    return Model(
        id=str(meta.get("id") or directory.name),
        name=str(meta.get("name") or directory.name),
        provider=str(meta.get("provider") or "API"),
        provider_type=provider_type,
        base_url=base_url,
        remote_model=str(meta.get("remote_model") or meta.get("id") or directory.name),
        api_key_env=str(meta.get("api_key_env") or "").strip(),
        description=str(meta.get("description") or ""),
        modality=str(meta.get("modality") or "LLM").upper(),
        capabilities=tuple(str(item) for item in capabilities) if isinstance(capabilities, list) else ("chat",),
        context_length=meta.get("context_length") if isinstance(meta.get("context_length"), int) else None,
        parameter_profile=str(meta.get("parameter_profile") or "").lower(),
        unsupported_fields=tuple(str(item) for item in meta.get("unsupported_fields", [])),
        uses_completion_tokens=bool(meta.get("uses_completion_tokens")),
        parameter_overrides=meta.get("parameter_overrides") if isinstance(meta.get("parameter_overrides"), dict) else {},
        directory=str(directory),
    )


class ModelRegistry:
    """``models/`` 아래 디렉터리를 스캔해 호출 가능한 모델 목록을 만든다."""

    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir
        self._lock = threading.Lock()

    def list(self) -> list[Model]:
        with self._lock:
            return self._scan()

    def get(self, model_id: str) -> Model:
        for model in self.list():
            if model.id == model_id:
                return model
        raise ApiError(404, "model_not_found", f"'{model_id}' 모델이 등록부에 없습니다.")

    def providers(self) -> list[str]:
        return sorted({model.provider for model in self.list()})

    def _scan(self) -> list[Model]:
        if not self.models_dir.is_dir():
            logger.warning("models directory does not exist: %s", self.models_dir)
            return []
        models: dict[str, Model] = {}
        for directory in sorted(self.models_dir.iterdir()):
            if not directory.is_dir() or directory.name.startswith("."):
                continue
            model = build_model(directory)
            if model is None or model.id in models:
                continue
            models[model.id] = model
        return list(models.values())
