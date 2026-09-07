"""The single JSON-defined source of every parameter the UI can send to a model."""

from __future__ import annotations

import copy
import json
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..core.errors import ApiError
from .model_registry import Model

OVERRIDABLE_KEYS = ("default", "min", "max", "step", "options", "hidden", "advanced", "help", "max_items")


@dataclass
class ResolvedParameters:
    """Validated values split by where they belong in the engine request."""

    values: dict[str, Any] = field(default_factory=dict)
    body: dict[str, Any] = field(default_factory=dict)
    extra_body: dict[str, Any] = field(default_factory=dict)
    chat_template_kwargs: dict[str, Any] = field(default_factory=dict)
    client: dict[str, Any] = field(default_factory=dict)


def _as_bool(key: str, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.lower() in {"true", "false"}:
        return value.lower() == "true"
    raise ApiError(422, "invalid_parameter", f"{key}는 true/false 값이어야 합니다.", [{"key": key}])


def _as_number(spec: dict, value: Any) -> int | float:
    key = spec["key"]
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ApiError(422, "invalid_parameter", f"{key}는 숫자여야 합니다.", [{"key": key}]) from None
    if spec["type"] == "int":
        if number != int(number):
            raise ApiError(422, "invalid_parameter", f"{key}는 정수여야 합니다.", [{"key": key}])
        number = int(number)
    minimum, maximum = spec.get("min"), spec.get("max")
    if minimum is not None and number < minimum:
        raise ApiError(422, "invalid_parameter", f"{key}는 {minimum} 이상이어야 합니다.", [{"key": key}])
    if maximum is not None and number > maximum:
        raise ApiError(422, "invalid_parameter", f"{key}는 {maximum} 이하여야 합니다.", [{"key": key}])
    return number


def _as_string(spec: dict, value: Any) -> str:
    key = spec["key"]
    text = str(value)
    options = spec.get("options")
    if options and text not in options:
        raise ApiError(422, "invalid_parameter", f"{key}는 {', '.join(options)} 중 하나여야 합니다.", [{"key": key}])
    return text


def _as_string_list(spec: dict, value: Any) -> list[str]:
    key = spec["key"]
    if isinstance(value, str):
        items = [item.strip() for item in value.split(",")]
    elif isinstance(value, list):
        items = [str(item).strip() for item in value]
    else:
        raise ApiError(422, "invalid_parameter", f"{key}는 문자열 목록이어야 합니다.", [{"key": key}])
    items = [item for item in items if item]
    max_items = spec.get("max_items")
    if max_items is not None and len(items) > max_items:
        raise ApiError(422, "invalid_parameter", f"{key}는 최대 {max_items}개까지 지정할 수 있습니다.", [{"key": key}])
    return items


def coerce(spec: dict, value: Any) -> Any:
    """Coerce and validate one raw UI value against its specification."""
    if value is None or value == "":
        if spec.get("nullable") or value is None:
            return None
        return None
    kind = spec["type"]
    if kind == "bool":
        return _as_bool(spec["key"], value)
    if kind in {"int", "float"}:
        return _as_number(spec, value)
    if kind == "string[]":
        return _as_string_list(spec, value)
    return _as_string(spec, value)


class ParameterCatalog:
    """Loads ``parameters.json`` and applies per-model visibility and overrides."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._mtime = 0.0
        self._document: dict = {"version": "0", "groups": [], "parameters": []}
        self.reload()

    def reload(self) -> dict:
        with self._lock:
            try:
                stat = self.path.stat()
            except OSError as exc:
                raise ApiError(500, "parameters_unavailable", f"파라미터 정의 파일을 읽을 수 없습니다: {exc}") from exc
            if stat.st_mtime != self._mtime:
                with self.path.open(encoding="utf-8") as handle:
                    document = json.load(handle)
                self._validate(document)
                self._document = document
                self._mtime = stat.st_mtime
            return self._document

    @staticmethod
    def _validate(document: Any) -> None:
        if not isinstance(document, dict) or not isinstance(document.get("parameters"), list):
            raise ApiError(500, "parameters_invalid", "파라미터 정의 파일의 형식이 올바르지 않습니다.")
        seen: set[str] = set()
        for spec in document["parameters"]:
            key = spec.get("key")
            if not key or key in seen:
                raise ApiError(500, "parameters_invalid", f"파라미터 key가 비었거나 중복되었습니다: {key}")
            seen.add(key)

    def specs_for(self, model: Model | None = None) -> list[dict]:
        """Parameter specs visible for a model, with the model's overrides applied."""
        document = self.reload()
        capabilities = set(model.capabilities) if model else set()
        overrides = model.parameter_overrides if model else {}
        visible: list[dict] = []
        provider_type = model.provider_type if model else None
        for raw in document["parameters"]:
            spec = copy.deepcopy(raw)
            required = spec.get("requires_capability")
            if required and model is not None and required not in capabilities:
                continue
            # 공급자가 받지 않는 항목은 보여주지 않는다(vLLM 확장 필드 등).
            providers = spec.get("providers")
            if providers and provider_type and provider_type not in providers:
                continue
            override = overrides.get(spec["key"]) if isinstance(overrides, dict) else None
            if isinstance(override, dict):
                if override.get("hidden"):
                    continue
                spec.update({key: override[key] for key in OVERRIDABLE_KEYS if key in override})
            visible.append(spec)
        return visible

    def schema_for(self, model: Model | None = None) -> dict:
        document = self.reload()
        specs = self.specs_for(model)
        used_groups = {spec["group"] for spec in specs}
        groups = [group for group in document.get("groups", []) if group["id"] in used_groups]
        groups.sort(key=lambda group: group.get("order", 0))
        return {
            "version": document.get("version", "0"),
            "model_id": model.id if model else None,
            "groups": groups,
            "parameters": specs,
            "defaults": {spec["key"]: spec.get("default") for spec in specs},
        }

    def defaults_for(self, model: Model | None = None) -> dict:
        return {spec["key"]: spec.get("default") for spec in self.specs_for(model)}

    def resolve(self, model: Model | None, values: Any) -> ResolvedParameters:
        """Validate raw UI values and split them into engine request buckets."""
        if values is None:
            values = {}
        if not isinstance(values, dict):
            raise ApiError(422, "invalid_parameters", "parameters는 객체여야 합니다.")
        specs = {spec["key"]: spec for spec in self.specs_for(model)}
        unknown = sorted(set(values) - set(specs))
        if unknown:
            raise ApiError(
                422,
                "unknown_parameter",
                f"지원하지 않는 파라미터입니다: {', '.join(unknown)}",
                [{"key": key} for key in unknown],
            )

        resolved = ResolvedParameters()
        for key, spec in specs.items():
            value = coerce(spec, values[key]) if key in values else spec.get("default")
            resolved.values[key] = value
        for key, spec in specs.items():
            value = resolved.values[key]
            if value is None or value == []:
                continue
            gate = spec.get("requires_parameter")
            if gate and not resolved.values.get(gate):
                continue
            bucket = {
                "body": resolved.body,
                "extra_body": resolved.extra_body,
                "chat_template_kwargs": resolved.chat_template_kwargs,
                "client": resolved.client,
            }[spec.get("target", "body")]
            bucket[key] = value
        return resolved
