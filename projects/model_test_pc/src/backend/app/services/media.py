"""음성·영상 모델 호출. 채팅과 요청 규격이 달라 별도 경로로 둔다.

- STT   `POST {base}/audio/transcriptions` (multipart) → 텍스트
- TTS   `POST {base}/audio/speech` (JSON) → 오디오 바이트
- VIDEO `POST {base}/videos` → 작업 폴링 → `GET {base}/videos/{id}/content` → mp4

OpenAI 규격 엔드포인트만 다룬다. 결과 파일은 `var/media/`에 두고 URL로 넘긴다.
base64로 브라우저까지 실어 보내면 영상에서 곧 터진다.
"""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from ..config import Config
from ..core.errors import ApiError
from .model_registry import Model, ModelRegistry
from .parameter_catalog import ParameterCatalog
from .providers import auth_headers, request_bytes

logger = logging.getLogger("app.media")

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # OpenAI 전사 업로드 상한과 같다
MAX_TTS_CHARS = 4096
VIDEO_POLL_SECONDS = 5.0
VIDEO_MAX_WAIT_SECONDS = 900.0
AUDIO_FORMAT_MIMES = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "opus": "audio/ogg",
    "aac": "audio/aac",
    "flac": "audio/flac",
    "pcm": "audio/L16",
}


def decode_data_url(name: str, data_url: str, limit: int) -> tuple[bytes, str]:
    """`data:<mime>;base64,...` → (바이트, mime)."""
    head, _, encoded = str(data_url or "").partition(",")
    if not encoded or "base64" not in head:
        raise ApiError(422, "invalid_file", f"'{name}'은(는) base64 data URL이 아닙니다.")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        raise ApiError(422, "invalid_file", f"'{name}'의 base64를 해석할 수 없습니다.") from None
    if not data:
        raise ApiError(422, "empty_file", f"'{name}'이 비어 있습니다.")
    if len(data) > limit:
        raise ApiError(413, "file_too_large", f"파일 하나는 {limit // (1024 * 1024)}MB를 넘을 수 없습니다.")
    return data, head[5:].split(";")[0] or "application/octet-stream"


def _multipart(fields: dict[str, str], filename: str, content: bytes, mime: str) -> tuple[bytes, str]:
    """stdlib만으로 multipart/form-data 본문을 만든다."""
    boundary = f"----modeltest{secrets.token_hex(8)}"
    parts: list[bytes] = []
    for key, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode("utf-8")
        )
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n".encode("utf-8")
    )
    parts.append(content)
    parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


class MediaStore:
    """생성된 오디오·영상 파일 보관소. 최신 N개만 남긴다."""

    def __init__(self, directory: Path, limit: int = 50) -> None:
        self.directory = directory
        self.limit = limit

    def save(self, data: bytes, suffix: str) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        media_id = uuid.uuid4().hex[:16]
        (self.directory / f"{media_id}{suffix}").write_bytes(data)
        self._trim()
        return media_id

    def path(self, media_id: str) -> Path:
        if not media_id.isalnum():
            raise ApiError(400, "invalid_media_id", "미디어 id 형식이 올바르지 않습니다.")
        for candidate in self.directory.glob(f"{media_id}.*"):
            return candidate
        raise ApiError(404, "media_not_found", f"'{media_id}' 파일이 없습니다. 보관 한도를 넘어 정리되었을 수 있습니다.")

    def _trim(self) -> None:
        files = sorted(self.directory.iterdir(), key=lambda item: item.stat().st_mtime)
        for stale in files[: max(0, len(files) - self.limit)]:
            stale.unlink(missing_ok=True)


class MediaService:
    """STT·TTS·영상 생성을 실행해 채팅과 같은 모양의 run으로 돌려준다."""

    def __init__(self, config: Config, registry: ModelRegistry, catalog: ParameterCatalog, store: MediaStore) -> None:
        self.config = config
        self.registry = registry
        self.catalog = catalog
        self.store = store

    # ---------- 공통 ----------

    def _model(self, request: dict, modality: str) -> Model:
        model_id = str(request.get("model_id") or "").strip()
        if not model_id:
            raise ApiError(422, "model_id_required", "사용할 model_id가 필요합니다.")
        model = self.registry.get(model_id)
        if model.modality != modality:
            raise ApiError(422, "modality_mismatch", f"'{model.id}'는 {model.modality} 모델입니다. {modality} 모델을 선택해 주세요.")
        if model.provider_type != "openai":
            raise ApiError(
                422,
                "provider_not_supported",
                f"{modality} 호출은 OpenAI 규격 엔드포인트만 지원합니다('{model.id}'는 {model.provider_type}).",
            )
        return model

    @staticmethod
    def _run(model: Model, prompt: str, parameters: dict) -> dict:
        return {
            "id": uuid.uuid4().hex[:12],
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "model_id": model.id,
            "provider": model.provider,
            "provider_type": model.provider_type,
            "modality": model.modality,
            "prompt": prompt,
            "system_prompt": "",
            "parameters": parameters,
        }

    def _media_payload(self, data: bytes, mime: str, name: str) -> dict:
        suffix = mimetypes.guess_extension(mime) or ".bin"
        media_id = self.store.save(data, suffix)
        return {
            "url": f"/api/v1/media/files/{media_id}",
            "mime": mime,
            "name": name,
            "bytes": len(data),
        }

    # ---------- STT ----------

    def transcribe(self, request: dict) -> dict:
        """오디오 한 개를 텍스트로 옮긴다. 결과 텍스트가 곧 run의 답변이다."""
        model = self._model(request, "STT")
        attachment = request.get("file")
        if not isinstance(attachment, dict) or not attachment.get("data_url"):
            raise ApiError(422, "audio_required", "전사할 오디오 파일을 첨부해 주세요.")
        name = str(attachment.get("name") or "audio")
        data, mime = decode_data_url(name, attachment["data_url"], MAX_AUDIO_BYTES)
        resolved = self.catalog.resolve(model, request.get("parameters"))

        fields = {"model": model.remote_model or model.id, "response_format": "json"}
        language = resolved.values.get("language")
        if language:
            fields["language"] = str(language)
        body, content_type = _multipart(fields, name, data, mime)

        started = time.monotonic()
        raw = request_bytes(
            self.config,
            model,
            f"{model.base_url}/audio/transcriptions",
            data=body,
            headers={"Content-Type": content_type, **auth_headers(model)},
        )
        elapsed = time.monotonic() - started
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {"text": raw.decode("utf-8", errors="replace")}
        text = str(payload.get("text") or "").strip()
        if not text:
            raise ApiError(502, "empty_transcript", "전사 결과가 비어 있습니다.")

        run = self._run(model, f"[오디오 전사] {name}", resolved.values)
        run.update({
            "text": text,
            "reasoning": "",
            "usage": payload.get("usage") if isinstance(payload.get("usage"), dict) else None,
            "latency_ms": round(elapsed * 1000),
            "source_file": name,
        })
        return run

    # ---------- TTS ----------

    def speak(self, request: dict) -> dict:
        """텍스트를 음성 파일로 만들고, 재생 URL을 run에 담는다."""
        model = self._model(request, "TTS")
        text = str(request.get("prompt") or "").strip()
        if not text:
            raise ApiError(422, "empty_prompt", "음성으로 만들 문장을 입력해 주세요.")
        if len(text) > MAX_TTS_CHARS:
            raise ApiError(422, "prompt_too_long", f"한 번에 {MAX_TTS_CHARS}자까지 음성으로 만들 수 있습니다.")
        resolved = self.catalog.resolve(model, request.get("parameters"))

        audio_format = str(resolved.values.get("audio_format") or "mp3")
        body: dict[str, Any] = {
            "model": model.remote_model or model.id,
            "input": text,
            "voice": str(resolved.values.get("voice") or "alloy"),
            "response_format": audio_format,
        }
        if resolved.values.get("speed"):
            body["speed"] = resolved.values["speed"]

        started = time.monotonic()
        audio = request_bytes(
            self.config,
            model,
            f"{model.base_url}/audio/speech",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", **auth_headers(model)},
        )
        elapsed = time.monotonic() - started
        if not audio:
            raise ApiError(502, "empty_audio", "엔드포인트가 빈 오디오를 반환했습니다.")

        mime = AUDIO_FORMAT_MIMES.get(audio_format, "application/octet-stream")
        media = self._media_payload(audio, mime, f"{model.id}.{audio_format}")
        run = self._run(model, text, resolved.values)
        run.update({
            "text": f"[음성 생성] {audio_format.upper()} · {media['bytes'] / 1024:.0f}KB",
            "reasoning": "",
            "usage": None,
            "latency_ms": round(elapsed * 1000),
            "media": media,
        })
        return run

    # ---------- VIDEO ----------

    def video(self, request: dict) -> Iterator[dict]:
        """영상 생성은 분 단위로 걸린다. 작업을 폴링하며 진행 상황을 흘려보낸다."""
        model = self._model(request, "VIDEO")
        prompt = str(request.get("prompt") or "").strip()
        if not prompt:
            raise ApiError(422, "empty_prompt", "영상으로 만들 장면을 설명해 주세요.")
        resolved = self.catalog.resolve(model, request.get("parameters"))

        run = self._run(model, prompt, resolved.values)
        yield {"type": "start", "run": {key: run[key] for key in ("id", "created_at", "model_id", "parameters")}}

        body: dict[str, Any] = {"model": model.remote_model or model.id, "prompt": prompt}
        for key in ("seconds", "size"):
            if resolved.values.get(key):
                body[key] = str(resolved.values[key])
        headers = {"Content-Type": "application/json", **auth_headers(model)}
        started = time.monotonic()
        try:
            job = self._json(
                request_bytes(
                    self.config, model, f"{model.base_url}/videos",
                    data=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers,
                )
            )
            job_id = str(job.get("id") or "")
            if not job_id:
                raise ApiError(502, "video_job_missing", f"영상 작업 id를 받지 못했습니다: {str(job)[:200]}")
            yield {"type": "status", "status": str(job.get("status") or "queued"), "progress": job.get("progress") or 0}

            job = yield from self._wait(model, job_id, job, headers)
            content = request_bytes(
                self.config, model, f"{model.base_url}/videos/{job_id}/content",
                headers=auth_headers(model), method="GET",
            )
        except ApiError as error:
            logger.warning("video generation failed: %s", error.message)
            yield {"type": "error", "status": error.status, "error": error.to_dict()["error"]}
            return

        media = self._media_payload(content, "video/mp4", f"{model.id}.mp4")
        run.update({
            "text": f"[영상 생성] {body.get('seconds', '기본')}초 · {body.get('size', '기본 해상도')} · {media['bytes'] / 1024 / 1024:.1f}MB",
            "reasoning": "",
            "usage": None,
            "latency_ms": round((time.monotonic() - started) * 1000),
            "media": media,
        })
        yield {"type": "done", "run": run}

    def _wait(self, model: Model, job_id: str, job: dict, headers: dict) -> Iterator[dict]:
        """완료까지 폴링한다. 진행 이벤트를 내보내고 마지막 작업 상태를 돌려준다."""
        deadline = time.monotonic() + VIDEO_MAX_WAIT_SECONDS
        while str(job.get("status")) not in {"completed", "succeeded"}:
            if str(job.get("status")) in {"failed", "cancelled", "canceled"}:
                detail = (job.get("error") or {}).get("message") if isinstance(job.get("error"), dict) else job.get("status")
                raise ApiError(502, "video_failed", f"영상 생성이 실패했습니다: {detail}")
            if time.monotonic() > deadline:
                raise ApiError(504, "video_timeout", f"영상 생성이 {int(VIDEO_MAX_WAIT_SECONDS / 60)}분 안에 끝나지 않았습니다.")
            time.sleep(VIDEO_POLL_SECONDS)
            job = self._json(
                request_bytes(
                    self.config, model, f"{model.base_url}/videos/{job_id}",
                    headers=auth_headers(model), method="GET",
                )
            )
            yield {"type": "status", "status": str(job.get("status") or "in_progress"), "progress": job.get("progress") or 0}
        return job

    @staticmethod
    def _json(raw: bytes) -> dict:
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            raise ApiError(502, "invalid_provider_response", "엔드포인트 응답을 JSON으로 해석할 수 없습니다.") from None
        return payload if isinstance(payload, dict) else {}
