"""Single-model serving lifecycle: selecting a model stops whatever was served before."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from ..config import Config
from ..core.errors import ApiError
from .engines import Engine, RemoteApiEngine
from .model_registry import Model, ModelRegistry

logger = logging.getLogger("app.serving")

IDLE = "idle"
STARTING = "starting"
READY = "ready"
STOPPING = "stopping"
ERROR = "error"


@dataclass
class ServingState:
    status: str = IDLE
    model: Model | None = None
    message: str = "서빙 중인 모델이 없습니다."
    requested_at: float | None = None
    ready_at: float | None = None
    generation: int = 0
    extra: dict[str, Any] = field(default_factory=dict)


class ServingManager:
    """Owns the invariant that at most one model is served at any moment."""

    def __init__(
        self,
        config: Config,
        registry: ModelRegistry,
        engine: Engine,
        remote_engine: Engine | None = None,
    ) -> None:
        self.config = config
        self.registry = registry
        self.local_engine = engine
        self.remote_engine = remote_engine or RemoteApiEngine(config)
        self.engine = engine  # 현재 활성 엔진
        self._lock = threading.RLock()
        self._state = ServingState()
        self._watcher: threading.Thread | None = None

    def _engine_for(self, model: Model) -> Engine:
        return self.remote_engine if model.is_remote else self.local_engine

    def status(self) -> dict:
        with self._lock:
            state = self._state
            model = state.model
            elapsed = round(time.time() - state.requested_at, 1) if state.requested_at else None
            return {
                "status": state.status,
                "engine": self.engine.name,
                "base_url": self.engine.base_url,
                "model": model.to_dict() if model else None,
                "model_id": model.id if model else None,
                "message": state.message,
                "pid": self.engine.pid,
                "requested_at": state.requested_at,
                "ready_at": state.ready_at,
                "elapsed_seconds": elapsed,
                **state.extra,
            }

    def logs(self, tail: int = 200) -> dict:
        return {"engine": self.engine.name, "lines": self.engine.logs(tail)}

    def serve(self, model_id: str) -> dict:
        """Stop the current model, then start ``model_id`` and watch it become ready."""
        model = self.registry.get(model_id)
        if not model.has_weights:
            logger.warning("model '%s' has no local weight files", model.id)
        with self._lock:
            current = self._state.model
            if self._state.status == READY and current and current == model:
                return self.status()
            self._stop_locked()
            self.engine = self._engine_for(model)
            self._state = ServingState(
                status=STARTING,
                model=model,
                message=f"'{model.id}' 모델을 서빙하는 중입니다.",
                requested_at=time.time(),
                generation=self._state.generation + 1,
            )
            generation = self._state.generation
            try:
                self.engine.start(model)
            except ApiError as error:
                self._state = ServingState(
                    status=ERROR,
                    model=model,
                    message=error.message,
                    requested_at=time.time(),
                    generation=generation,
                )
                raise
            self._watcher = threading.Thread(target=self._await_ready, args=(generation,), daemon=True)
            self._watcher.start()
            return self.status()

    def stop(self) -> dict:
        with self._lock:
            self._stop_locked()
            return self.status()

    def _stop_locked(self) -> None:
        if not self.engine.is_alive():
            self._state = ServingState(generation=self._state.generation)
            return
        stopped = self._state.model.id if self._state.model else "unknown"
        self._state.status = STOPPING
        self.engine.stop()
        self._state = ServingState(
            message=f"'{stopped}' 서빙을 중단했습니다.",
            generation=self._state.generation,
        )

    def _await_ready(self, generation: int) -> None:
        deadline = time.monotonic() + self.config.startup_timeout
        while time.monotonic() < deadline:
            with self._lock:
                if self._state.generation != generation:
                    return
                if not self.engine.is_alive():
                    exit_code = getattr(self.engine, "exit_code", lambda: None)()
                    self._fail(
                        generation,
                        f"서빙 프로세스가 예기치 않게 종료되었습니다(종료 코드 {exit_code}). "
                        "'로그 보기'에서 원인을 확인해 주세요.",
                    )
                    return
            if self.engine.probe_ready():
                with self._lock:
                    if self._state.generation != generation:
                        return
                    model_id = self._state.model.id if self._state.model else "model"
                    self._state.status = READY
                    self._state.ready_at = time.time()
                    self._state.message = f"'{model_id}' 모델을 서빙하고 있습니다."
                logger.info("model '%s' is ready", model_id)
                return
            time.sleep(1.0)
        self._fail(generation, f"{int(self.config.startup_timeout)}초 안에 서빙이 준비되지 않았습니다.")

    def _fail(self, generation: int, message: str) -> None:
        with self._lock:
            if self._state.generation != generation:
                return
            logger.error("serving failed: %s", message)
            self._state.status = ERROR
            self._state.message = message
            self.engine.stop()

    def active_model(self) -> Model | None:
        with self._lock:
            return self._state.model if self._state.status == READY else None

    def require_ready(self, model_id: str | None = None) -> Model:
        """Return the serving model, rejecting requests aimed at anything else."""
        with self._lock:
            state = self._state
            if state.status != READY or state.model is None:
                raise ApiError(409, "model_not_ready", f"서빙이 준비되지 않았습니다: {state.message}")
            if model_id and model_id != state.model.id:
                raise ApiError(
                    409,
                    "model_mismatch",
                    f"현재 '{state.model.id}' 모델만 서빙 중입니다. '{model_id}' 모델을 먼저 선택해 주세요.",
                )
            return state.model

    def shutdown(self) -> None:
        with self._lock:
            self._stop_locked()
