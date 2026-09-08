"""API 공급자 어댑터. 이 프로젝트는 로컬 모델을 서빙하지 않고 호출만 한다.

- `openai`: OpenAI 및 OpenAI 호환 엔드포인트(사내 vLLM/TGI 등)
- `anthropic`: Anthropic Messages API

두 공급자의 응답을 OpenAI 청크 모양으로 통일해 상위 계층을 하나로 유지한다.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Iterator

from ..config import Config
from ..core.errors import ApiError
from .model_registry import Model
from .secrets import get_secret, scrub

logger = logging.getLogger("app.providers")

ANTHROPIC_VERSION = "2023-06-01"

# 공급자가 실제로 받는 필드만 통과시킨다. 나머지는 400을 부른다.
OPENAI_FIELDS = {"temperature", "top_p", "max_tokens", "n", "seed",
                 "frequency_penalty", "presence_penalty", "logprobs", "top_logprobs", "stop"}
ANTHROPIC_FIELDS = {"max_tokens", "stop", "temperature", "top_p", "top_k"}


def _iter_sse(response) -> Iterator[dict]:
    """OpenAI 형식 ``text/event-stream``에서 JSON 페이로드만 뽑는다."""
    for raw in response:
        line = raw.decode("utf-8", errors="replace").strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            return
        try:
            yield json.loads(data)
        except json.JSONDecodeError:
            logger.warning("dropping malformed stream chunk: %s", data[:200])


class Provider:
    """모델 하나를 호출하는 방법. 프로세스도 수명주기도 없다."""

    def __init__(self, config: Config, model: Model) -> None:
        self.config = config
        self.model = model

    @property
    def name(self) -> str:
        return self.model.provider_type

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        raise NotImplementedError

    def _post(self, url: str, body: dict, headers: dict) -> Iterator[bytes]:
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
            raise ApiError(502, "provider_error", f"'{self.model.id}' 호출이 거부되었습니다: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ApiError(
                504,
                "provider_unreachable",
                f"'{self.model.id}' 엔드포인트({self.model.base_url})에 연결할 수 없습니다: {exc}",
            ) from exc

    def _key(self) -> str | None:
        if not self.model.api_key_env:
            return None
        key = get_secret(self.model.api_key_env)
        if not key:
            raise ApiError(
                400,
                "api_key_missing",
                f"'{self.model.id}'에 필요한 API 키({self.model.api_key_env})가 설정되어 있지 않습니다. "
                "var/secrets.env를 확인해 주세요.",
            )
        return key


class OpenAICompatibleProvider(Provider):
    """OpenAI API와, 같은 규격을 제공하는 사내 엔드포인트 모두를 처리한다."""

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        body = {key: value for key, value in payload.items() if key in OPENAI_FIELDS}
        # 최신 OpenAI 모델은 max_tokens 대신 max_completion_tokens를 받는다.
        if "max_tokens" in body and self.model.uses_completion_tokens:
            body["max_completion_tokens"] = body.pop("max_tokens")
        for field in self.model.unsupported_fields:
            body.pop(field, None)
        body.update({
            "model": self.model.remote_model or self.model.id,
            "messages": payload["messages"],
            "stream": True,
            "stream_options": {"include_usage": True},
        })
        effort = payload.get("chat_template_kwargs", {}).get("reasoning_effort")
        if effort:
            body["reasoning_effort"] = effort

        key = self._key()
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        yield from _iter_sse(self._post(f"{self.model.base_url}/chat/completions", body, headers))


class AnthropicProvider(Provider):
    """Anthropic Messages API. 요청·응답 형식을 OpenAI 모양으로 변환한다."""

    def chat_stream(self, payload: dict) -> Iterator[dict]:
        messages = [self._to_block(message) for message in payload["messages"] if message.get("role") != "system"]
        system = " ".join(
            str(message.get("content", "")) for message in payload["messages"] if message.get("role") == "system"
        )
        body = {key: value for key, value in payload.items() if key in ANTHROPIC_FIELDS}
        for field in self.model.unsupported_fields:
            body.pop(field, None)
        body.update({
            "model": self.model.remote_model or self.model.id,
            "messages": messages,
            "stream": True,
            "max_tokens": int(payload.get("max_tokens") or 4096),
        })
        if system.strip():
            body["system"] = system
        if "stop" in body:
            body["stop_sequences"] = body.pop("stop")

        headers = {"x-api-key": self._key() or "", "anthropic-version": ANTHROPIC_VERSION}
        yield from self._translate(self._post(f"{self.model.base_url}/messages", body, headers))

    @staticmethod
    def _to_block(message: dict) -> dict:
        """OpenAI content 배열(텍스트·이미지)을 Anthropic 블록으로 바꾼다."""
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
    def _translate(lines: Iterator[bytes]) -> Iterator[dict]:
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
                usage["prompt_tokens"] = ((event.get("message") or {}).get("usage") or {}).get("input_tokens", 0)
            elif kind == "message_delta":
                usage["completion_tokens"] = (event.get("usage") or {}).get("output_tokens", 0)
            elif kind == "message_stop":
                usage["total_tokens"] = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)
                yield {"choices": [{"delta": {}, "finish_reason": "stop"}], "usage": usage}
            elif kind == "error":
                message = (event.get("error") or {}).get("message", "알 수 없는 오류")
                raise ApiError(502, "provider_error", f"공급자 오류: {message}")


PROVIDERS = {"openai": OpenAICompatibleProvider, "anthropic": AnthropicProvider}


def create_provider(config: Config, model: Model) -> Provider:
    factory = PROVIDERS.get(model.provider_type)
    if factory is None:
        raise ApiError(
            500,
            "unknown_provider",
            f"'{model.id}'의 provider_type '{model.provider_type}'을 지원하지 않습니다. "
            f"({', '.join(sorted(PROVIDERS))} 중 하나여야 합니다)",
        )
    return factory(config, model)
