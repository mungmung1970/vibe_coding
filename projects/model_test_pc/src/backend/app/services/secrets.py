"""API 키 로딩과 마스킹. 키는 저장소 밖 파일에 두고 여기서만 읽는다."""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger("app.secrets")

MASK_KEEP = 4


def load_secrets(path: Path) -> int:
    """``KEY=VALUE`` 파일을 환경변수로 올린다. 이미 설정된 값은 덮어쓰지 않는다."""
    if not path.is_file():
        logger.info("secrets file not found: %s", path)
        return 0
    loaded = 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("'\"")
        if not key or not value:
            continue
        os.environ.setdefault(key, value)
        loaded += 1
    logger.info("loaded %d secret(s) from %s", loaded, path)
    return loaded


def get_secret(name: str) -> str | None:
    value = os.environ.get(name)
    return value or None


def mask(value: str | None) -> str:
    """로그·오류 메시지에 쓸 마스킹 문자열."""
    if not value:
        return "(없음)"
    if len(value) <= MASK_KEEP * 2:
        return "*" * len(value)
    return f"{value[:MASK_KEEP]}…{value[-MASK_KEEP:]}"


def scrub(text: str) -> str:
    """문자열에 섞인 키 값을 마스킹한다. 외부 오류 본문을 그대로 노출하지 않기 위함."""
    for name in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY"):
        value = os.environ.get(name)
        if value and value in text:
            text = text.replace(value, mask(value))
    return text
