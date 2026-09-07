"""Discovery of servable models under the models directory."""

from __future__ import annotations

import json
import logging
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ..core.errors import ApiError

logger = logging.getLogger("model_test.registry")

METADATA_FILE = "model.json"
HF_CONFIG_FILE = "config.json"
WEIGHT_SUFFIXES = (".safetensors", ".bin", ".gguf", ".pt")


LOCAL = "local"
REMOTE_TYPES = ("openai", "anthropic")


@dataclass(frozen=True)
class Model:
    """A model the console can hand to the serving engine, local or remote."""

    id: str
    name: str
    provider: str
    description: str
    directory: str
    serve_path: str
    provider_type: str = LOCAL
    modality: str = "LLM"
    remote_model: str = ""
    api_key_env: str = ""
    capabilities: tuple[str, ...] = ()
    context_length: int | None = None
    engine_args: dict[str, Any] = field(default_factory=dict)
    parameter_overrides: dict[str, Any] = field(default_factory=dict)
    has_weights: bool = False

    @property
    def is_remote(self) -> bool:
        return self.provider_type in REMOTE_TYPES

    @property
    def label(self) -> str:
        """UI 표시용 이름. 모델 유형을 괄호로 덧붙인다."""
        return f"{self.name} ({self.modality})"

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["capabilities"] = list(self.capabilities)
        payload["is_remote"] = self.is_remote
        payload["label"] = self.label
        return payload


def _read_json(path: Path) -> dict:
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("skipping unreadable metadata %s: %s", path, exc)
        return {}
    return data if isinstance(data, dict) else {}


def _has_weights(directory: Path) -> bool:
    """True when the directory actually holds weight files (not just metadata)."""
    try:
        return any(child.suffix in WEIGHT_SUFFIXES for child in directory.iterdir() if child.is_file())
    except OSError as exc:
        logger.warning("cannot read %s: %s", directory, exc)
        return False


def _capabilities(meta: dict, hf_config: dict) -> tuple[str, ...]:
    declared = meta.get("capabilities")
    if isinstance(declared, list):
        return tuple(str(item) for item in declared)
    capabilities = ["chat"]
    architectures = " ".join(hf_config.get("architectures", [])).lower()
    model_type = str(hf_config.get("model_type", "")).lower()
    if any(marker in f"{architectures} {model_type}" for marker in ("gptoss", "gpt_oss", "qwen3", "deepseek")):
        capabilities.append("reasoning")
    return tuple(capabilities)


def _modality(meta: dict, hf_config: dict) -> str:
    """선언값이 없으면 허깅페이스 설정의 비전 항목으로 LLM/VLM을 판정한다."""
    declared = str(meta.get("modality") or "").upper()
    if declared in {"LLM", "VLM"}:
        return declared
    vision_keys = ("vision_config", "vision_tower", "image_token_id", "vision_start_token_id")
    return "VLM" if any(key in hf_config for key in vision_keys) else "LLM"


def _context_length(meta: dict, hf_config: dict) -> int | None:
    for source, key in ((meta, "context_length"), (hf_config, "max_position_embeddings")):
        value = source.get(key)
        if isinstance(value, int) and value > 0:
            return value
    return None


def build_model(directory: Path) -> Model | None:
    """Build a model entry from a directory, or return None when it is not a model."""
    meta_path = directory / METADATA_FILE
    hf_path = directory / HF_CONFIG_FILE
    meta = _read_json(meta_path) if meta_path.is_file() else {}
    hf_config = _read_json(hf_path) if hf_path.is_file() else {}
    if not meta and not hf_config:
        return None

    provider_type = str(meta.get("provider_type") or LOCAL).lower()
    remote_model = str(meta.get("remote_model") or "").strip()

    if provider_type in REMOTE_TYPES:
        # 원격 모델은 가중치가 없다. 서빙 대상은 공급자의 모델 이름이다.
        serve_path = remote_model or str(meta.get("id") or directory.name)
        has_weights = True
    else:
        raw_path = str(meta.get("path") or "").strip()
        if raw_path:
            candidate = Path(raw_path).expanduser()
            serve_path = str(candidate if candidate.is_absolute() else (directory / candidate).resolve())
        else:
            serve_path = str(meta.get("hf_id") or "").strip() or str(directory)
        weights_dir = Path(serve_path)
        has_weights = _has_weights(weights_dir if weights_dir.is_dir() else directory) or bool(meta.get("hf_id"))
        # 등록부에는 메타데이터만 있고 config.json은 가중치 쪽에 있다.
        if not hf_config and weights_dir.is_dir() and (weights_dir / HF_CONFIG_FILE).is_file():
            hf_config = _read_json(weights_dir / HF_CONFIG_FILE)

    engine_args = meta.get("engine_args") if isinstance(meta.get("engine_args"), dict) else {}
    overrides = meta.get("parameter_overrides") if isinstance(meta.get("parameter_overrides"), dict) else {}

    return Model(
        id=str(meta.get("id") or directory.name),
        name=str(meta.get("name") or directory.name),
        provider=str(meta.get("provider") or "Local"),
        description=str(meta.get("description") or ""),
        directory=str(directory),
        serve_path=serve_path,
        provider_type=provider_type,
        modality=_modality(meta, hf_config),
        remote_model=remote_model,
        api_key_env=str(meta.get("api_key_env") or "").strip(),
        capabilities=_capabilities(meta, hf_config),
        context_length=_context_length(meta, hf_config),
        engine_args=engine_args,
        parameter_overrides=overrides,
        has_weights=has_weights,
    )


class ModelRegistry:
    """Scans ``models_dir`` for model directories and answers lookups by id."""

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
        raise ApiError(404, "model_not_found", f"'{model_id}' 모델을 models 디렉터리에서 찾을 수 없습니다.")

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
            if model is None:
                continue
            if model.id in models:
                logger.warning("duplicate model id '%s' in %s is ignored", model.id, directory)
                continue
            models[model.id] = model
        return list(models.values())
