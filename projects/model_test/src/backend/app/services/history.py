"""Append-only run history stored as JSON Lines."""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

from ..core.errors import ApiError

logger = logging.getLogger("model_test.history")

SUMMARY_FIELDS = ("id", "created_at", "model_id", "provider", "engine", "prompt", "parameters", "latency_ms", "usage")
PREVIEW_CHARS = 400


class HistoryStore:
    """Keeps completed runs so the 결과 조회 view can list and compare them."""

    def __init__(self, path: Path, limit: int = 500) -> None:
        self.path = path
        self.limit = limit
        self._lock = threading.Lock()

    def append(self, run: dict) -> None:
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(run, ensure_ascii=False) + "\n")
            self._trim_locked()

    def _trim_locked(self) -> None:
        runs = self._read_locked()
        if len(runs) <= self.limit:
            return
        kept = runs[-self.limit :]
        with self.path.open("w", encoding="utf-8") as handle:
            for run in kept:
                handle.write(json.dumps(run, ensure_ascii=False) + "\n")

    def _read_locked(self) -> list[dict]:
        if not self.path.is_file():
            return []
        runs: list[dict] = []
        with self.path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    run = json.loads(line)
                except json.JSONDecodeError:
                    logger.warning("skipping malformed history line in %s", self.path)
                    continue
                if isinstance(run, dict) and run.get("id"):
                    runs.append(run)
        return runs

    def list(
        self,
        model_id: str | None = None,
        query: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """Newest-first summaries, filtered the way the 결과 조회 sidebar filters them."""
        with self._lock:
            runs = self._read_locked()
        needle = (query or "").strip().lower()
        selected = []
        for run in reversed(runs):
            created = str(run.get("created_at", ""))[:10]
            if model_id and run.get("model_id") != model_id:
                continue
            if date_from and created and created < date_from:
                continue
            if date_to and created and created > date_to:
                continue
            if needle and needle not in f"{run.get('prompt', '')}\n{run.get('text', '')}".lower():
                continue
            selected.append(self._summarize(run))
            if len(selected) >= max(1, limit):
                break
        return selected

    @staticmethod
    def _summarize(run: dict) -> dict:
        summary: dict[str, Any] = {key: run.get(key) for key in SUMMARY_FIELDS}
        text = str(run.get("text") or "")
        summary["preview"] = text[:PREVIEW_CHARS]
        summary["truncated"] = len(text) > PREVIEW_CHARS
        return summary

    def get(self, run_id: str) -> dict:
        with self._lock:
            for run in reversed(self._read_locked()):
                if run.get("id") == run_id:
                    return run
        raise ApiError(404, "run_not_found", f"'{run_id}' 실행 기록을 찾을 수 없습니다.")

    def delete(self, run_id: str) -> None:
        with self._lock:
            runs = self._read_locked()
            kept = [run for run in runs if run.get("id") != run_id]
            if len(kept) == len(runs):
                raise ApiError(404, "run_not_found", f"'{run_id}' 실행 기록을 찾을 수 없습니다.")
            with self.path.open("w", encoding="utf-8") as handle:
                for run in kept:
                    handle.write(json.dumps(run, ensure_ascii=False) + "\n")

    def compare(self, run_ids: list[str]) -> dict:
        """Side-by-side view of runs plus the parameter keys that differ."""
        if len(run_ids) < 2:
            raise ApiError(422, "compare_needs_two", "비교하려면 두 개 이상의 실행을 선택해 주세요.")
        runs = [self.get(run_id) for run_id in run_ids]
        keys = sorted({key for run in runs for key in (run.get("parameters") or {})})
        differences = []
        for key in keys:
            values = [(run.get("parameters") or {}).get(key) for run in runs]
            if len({json.dumps(value, ensure_ascii=False, sort_keys=True) for value in values}) > 1:
                differences.append({"key": key, "values": values})
        return {
            "runs": runs,
            "parameter_differences": differences,
            "same_model": len({run.get("model_id") for run in runs}) == 1,
        }
