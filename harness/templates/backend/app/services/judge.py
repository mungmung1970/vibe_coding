"""모범답변을 기준으로 답변들을 채점하는 심판 모델 호출."""

from __future__ import annotations

import json
import logging
import re

from ..config import Config
from ..core.errors import ApiError
from .engines import RemoteApiEngine
from .model_registry import ModelRegistry
from .serving_manager import ServingManager

logger = logging.getLogger("app.judge")

MAX_ANSWER_CHARS = 6000
SYSTEM_PROMPT = (
    "너는 모델 답변을 채점하는 심판이다. 모범답변과 각 답변을 비교해 정확성·완결성·표현을 기준으로 평가한다. "
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

    def __init__(self, config: Config, registry: ModelRegistry, manager: ServingManager) -> None:
        self.config = config
        self.registry = registry
        self.manager = manager

    def candidates(self) -> list[dict]:
        """심판으로 쓸 수 있는 모델. 원격 모델과 현재 서빙 중인 로컬 모델."""
        served = self.manager.active_model()
        models = [model for model in self.registry.list() if model.is_remote]
        if served is not None and not served.is_remote:
            models.append(served)
        return [{"id": model.id, "label": model.label, "provider": model.provider} for model in models]

    def evaluate(self, judge_model_id: str, reference: str, runs: list[dict]) -> dict:
        model = self.registry.get(judge_model_id)
        engine = self._engine_for(model)
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
        for chunk in engine.chat_stream(payload):
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

    def _engine_for(self, model):
        if model.is_remote:
            engine = RemoteApiEngine(self.config)
            engine.start(model)
            return engine
        served = self.manager.active_model()
        if served is None or served.id != model.id:
            raise ApiError(
                409,
                "judge_not_served",
                f"로컬 모델 '{model.id}'로 채점하려면 먼저 그 모델을 서빙해야 합니다. "
                "외부 API 모델은 서빙 없이 바로 쓸 수 있습니다.",
            )
        return self.manager.engine

    @staticmethod
    def _build_prompt(reference: str, runs: list[dict]) -> str:
        lines = [f"[질문]\n{runs[0].get('prompt', '')}", f"\n[모범답변]\n{reference}"]
        for index, run in enumerate(runs, start=1):
            answer = str(run.get("text") or "")[:MAX_ANSWER_CHARS]
            lines.append(f"\n[답변 {index}] (모델: {run.get('model_id')})\n{answer}")
        lines.append("\n각 답변을 모범답변과 비교해 채점하고 JSON으로만 답하라.")
        return "\n".join(lines)
