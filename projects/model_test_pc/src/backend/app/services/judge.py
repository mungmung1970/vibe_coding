"""모범답변을 기준으로 답변들을 채점하는 심판 모델 호출."""

from __future__ import annotations

import json
import logging
import re

from ..config import Config
from ..core.errors import ApiError
from .inference import CHAT_MODALITIES
from .providers import create_provider
from .model_registry import ModelRegistry

logger = logging.getLogger("app.judge")

MAX_ANSWER_CHARS = 6000
SYSTEM_PROMPT = (
    "너는 모델 답변을 채점하는 심판이다. 각 답변을 정확성·완결성·표현을 기준으로 평가한다. "
    "모범답변이 주어지면 그것을 기준으로, 없으면 질문에 대한 적절성으로 채점한다. "
    "반드시 아래 JSON 스키마만 출력한다. 설명 문장을 덧붙이지 않는다.\n"
    '{"rankings":[{"index":1,"score":0-100,"reason":"한 문장"}],"summary":"두 문장 이내"}'
)


def _extract_json(text: str) -> dict | None:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


class JudgeService:
    """답변 비교 창에서 고른 모델로 채점을 수행한다."""

    def __init__(self, config: Config, registry: ModelRegistry) -> None:
        self.config = config
        self.registry = registry

    def candidates(self) -> list[dict]:
        """채팅 가능한 모델이면 모두 심판 후보다. 음성·영상 모델은 채점할 수 없다."""
        return [
            {"id": model.id, "label": model.label, "provider": model.provider}
            for model in self.registry.list()
            if model.modality in CHAT_MODALITIES
        ]

    def evaluate(self, judge_model_id: str, reference: str, runs: list[dict]) -> dict:
        model = self.registry.get(judge_model_id)
        provider = create_provider(self.config, model)
        prompt = self._build_prompt(reference, runs)
        payload = {
            "model": model.remote_model or model.id,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
            "max_tokens": 1500,
            "stream": True,
        }
        parts: list[str] = []
        for chunk in provider.chat_stream(payload):
            choices = chunk.get("choices") or []
            if choices:
                parts.append((choices[0].get("delta") or {}).get("content") or "")
        text = "".join(parts).strip()
        parsed = _extract_json(text)
        return {
            "judge_model_id": model.id,
            "judge_label": model.label,
            "rankings": parsed.get("rankings") if parsed else None,
            "summary": parsed.get("summary") if parsed else None,
            "raw": None if parsed else text,
        }



    @staticmethod
    def _build_prompt(reference: str, runs: list[dict]) -> str:
        """모범답변은 있으면 기준으로 쓰고, 없으면 질문 기준으로 채점하게 한다."""
        lines = [f"[질문]\n{runs[0].get('prompt', '')}"]
        if reference.strip():
            lines.append(f"\n[모범답변]\n{reference}")
        for index, run in enumerate(runs, start=1):
            answer = str(run.get("text") or "")[:MAX_ANSWER_CHARS]
            lines.append(f"\n[답변 {index}] (모델: {run.get('model_id')})\n{answer}")
        lines.append(
            "\n각 답변을 모범답변과 비교해 채점하고 JSON으로만 답하라."
            if reference.strip()
            else "\n모범답변은 없다. 질문에 대한 적절성으로 각 답변을 채점하고 JSON으로만 답하라."
        )
        return "\n".join(lines)
