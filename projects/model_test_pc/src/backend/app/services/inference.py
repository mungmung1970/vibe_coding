"""프롬프트 요청을 공급자 호출과 화면 이벤트 스트림으로 바꾼다."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Iterator

from ..config import Config
from ..core.errors import ApiError
from .history import HistoryStore
from .model_registry import Model, ModelRegistry
from .parameter_catalog import ParameterCatalog, ResolvedParameters
from .providers import create_provider

logger = logging.getLogger("app.inference")

MAX_PROMPT_CHARS = 200_000
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_IMAGE_CHARS = MAX_IMAGE_BYTES * 4 // 3 + 1024  # base64 팽창분


def _delta_text(chunk: dict) -> tuple[str, str]:
    """Extract (content, reasoning) text from one OpenAI-style stream chunk."""
    choices = chunk.get("choices") or []
    if not choices:
        return "", ""
    delta = choices[0].get("delta") or {}
    if not delta and "message" in choices[0]:
        delta = choices[0]["message"]
    content = delta.get("content") or ""
    reasoning = delta.get("reasoning_content") or delta.get("reasoning") or ""
    return (content if isinstance(content, str) else ""), (reasoning if isinstance(reasoning, str) else "")


class InferenceService:
    """Builds engine payloads, streams results, and records finished runs."""

    def __init__(
        self,
        config: Config,
        catalog: ParameterCatalog,
        registry: ModelRegistry,
        history: HistoryStore,
    ) -> None:
        self.config = config
        self.catalog = catalog
        self.registry = registry
        self.history = history

    def build_payload(
        self,
        model_id: str,
        prompt: str,
        system_prompt: str,
        resolved: ResolvedParameters,
        images: list[dict] | None = None,
    ) -> dict:
        messages = []
        if system_prompt.strip():
            messages.append({"role": "system", "content": system_prompt})
        if images:
            # OpenAI 형식으로 통일하고, 공급자별 변환은 엔진 어댑터가 맡는다.
            content: list[dict] = [{"type": "text", "text": prompt}]
            content += [{"type": "image_url", "image_url": {"url": image["data_url"]}} for image in images]
            messages.append({"role": "user", "content": content})
        else:
            messages.append({"role": "user", "content": prompt})
        payload: dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            **resolved.body,
            **resolved.extra_body,
        }
        if resolved.chat_template_kwargs:
            payload["chat_template_kwargs"] = dict(resolved.chat_template_kwargs)
        return payload

    def generate(self, request: dict) -> Iterator[dict]:
        """Validate the request, then yield start/delta/done events."""
        prompt = str(request.get("prompt") or "")
        if not prompt.strip():
            raise ApiError(422, "empty_prompt", "질문을 입력해 주세요.")
        if len(prompt) > MAX_PROMPT_CHARS:
            raise ApiError(422, "prompt_too_long", f"프롬프트는 {MAX_PROMPT_CHARS}자를 넘을 수 없습니다.")

        model_id = str(request.get("model_id") or "").strip()
        if not model_id:
            raise ApiError(422, "model_id_required", "사용할 model_id가 필요합니다.")
        model = self.registry.get(model_id)
        system_prompt = str(request.get("system_prompt") or "")
        resolved = self.catalog.resolve(model, request.get("parameters"))
        images = self._validate_images(model, request.get("images"))
        payload = self.build_payload(model.id, prompt, system_prompt, resolved, images)
        run = {
            "id": uuid.uuid4().hex[:12],
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "model_id": model.id,
            "provider": model.provider,
            "provider_type": model.provider_type,
            "prompt": prompt,
            "system_prompt": system_prompt,
            "parameters": resolved.values,
            "images": [image["name"] for image in images],  # 기록에는 파일명만 남긴다
        }
        return self._stream(model, run, payload, resolved)

    def _validate_images(self, model: Model, images: Any) -> list[dict]:
        """VLM 모델에서만, data URI 형식과 크기 제한을 지켜 첨부를 허용한다."""
        if not images:
            return []
        if not isinstance(images, list):
            raise ApiError(422, "invalid_images", "images는 배열이어야 합니다.")
        if model.modality != "VLM":
            raise ApiError(422, "images_not_supported", f"'{model.id}'는 이미지 입력을 지원하지 않는 LLM입니다.")
        if len(images) > MAX_IMAGES:
            raise ApiError(422, "too_many_images", f"이미지는 최대 {MAX_IMAGES}장까지 첨부할 수 있습니다.")
        checked = []
        for image in images:
            if not isinstance(image, dict):
                raise ApiError(422, "invalid_images", "각 이미지는 name과 data_url을 가진 객체여야 합니다.")
            data_url = str(image.get("data_url") or "")
            if not data_url.startswith("data:image/"):
                raise ApiError(422, "invalid_image_format", "이미지는 data:image/... 형식이어야 합니다.")
            if len(data_url) > MAX_IMAGE_CHARS:
                raise ApiError(422, "image_too_large", f"이미지 하나는 약 {MAX_IMAGE_BYTES // (1024 * 1024)}MB를 넘을 수 없습니다.")
            checked.append({"name": str(image.get("name") or "image"), "data_url": data_url})
        return checked

    def _stream(self, model: Model, run: dict, payload: dict, resolved: ResolvedParameters) -> Iterator[dict]:
        yield {"type": "start", "run": {key: run[key] for key in ("id", "created_at", "model_id", "parameters")}}
        started = time.monotonic()
        first_token_at: float | None = None
        text_parts: list[str] = []
        reasoning_parts: list[str] = []
        usage: dict | None = None
        try:
            for chunk in create_provider(self.config, model).chat_stream(payload):
                if isinstance(chunk.get("usage"), dict):
                    usage = chunk["usage"]
                content, reasoning = _delta_text(chunk)
                if reasoning:
                    reasoning_parts.append(reasoning)
                    yield {"type": "reasoning", "text": reasoning}
                if content:
                    if first_token_at is None:
                        first_token_at = time.monotonic()
                    text_parts.append(content)
                    yield {"type": "delta", "text": content}
        except ApiError as error:
            logger.warning("generation failed: %s", error.message)
            yield {"type": "error", "status": error.status, "error": error.to_dict()["error"]}
            return

        elapsed = time.monotonic() - started
        run.update(
            {
                "text": "".join(text_parts),
                "reasoning": "".join(reasoning_parts),
                "usage": usage,
                "latency_ms": round(elapsed * 1000),
                "ttft_ms": round((first_token_at - started) * 1000) if first_token_at else None,
                "show_thinking": bool(resolved.client.get("show_thinking")),
            }
        )
        yield {"type": "done", "run": run}
