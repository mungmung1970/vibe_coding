"""Entry point: wires services together and serves the API plus the frontend."""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import threading
from dataclasses import dataclass, replace
from http.server import ThreadingHTTPServer
from pathlib import Path

from .api.routes import build_router
from .config import Config
from .core.http import Router, StaticFiles, create_server
from .services.engines import Engine, create_engine
from .services.history import HistoryStore
from .services.inference import InferenceService
from .services.judge import JudgeService
from .services.model_registry import ModelRegistry
from .services.parameter_catalog import ParameterCatalog
from .services.secrets import load_secrets
from .services.serving_manager import ServingManager

logger = logging.getLogger("model_test")


@dataclass
class Services:
    """Every long-lived object the server needs, wired together."""

    config: Config
    registry: ModelRegistry
    catalog: ParameterCatalog
    manager: ServingManager
    history: HistoryStore
    inference: InferenceService
    judge: JudgeService
    router: Router


def build_services(config: Config, engine: Engine | None = None) -> Services:
    load_secrets(config.secrets_file)
    registry = ModelRegistry(config.models_dir)
    catalog = ParameterCatalog(config.parameters_file)
    manager = ServingManager(config, registry, engine or create_engine(config))
    history = HistoryStore(config.history_file, config.history_limit)
    inference = InferenceService(config, catalog, manager, history)
    judge = JudgeService(config, registry, manager)
    router = build_router(config, registry, catalog, manager, inference, history, judge)
    return Services(config, registry, catalog, manager, history, inference, judge, router)


def build_server(config: Config, engine: Engine | None = None) -> tuple[ThreadingHTTPServer, Services]:
    services = build_services(config, engine)
    static = StaticFiles(config.frontend_dir)
    return create_server(config.host, config.port, services.router, static), services


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="model-test-backend", description="LLM Lab 모델 테스트 백엔드")
    parser.add_argument("--host", help="바인딩 주소 (기본 127.0.0.1)")
    parser.add_argument("--port", type=int, help="바인딩 포트 (기본 8080)")
    parser.add_argument("--engine", choices=("auto", "vllm"), help="서빙 엔진 선택")
    parser.add_argument("--models-dir", help="모델 디렉터리 경로")
    parser.add_argument("--log-level", default="INFO", help="로그 레벨 (기본 INFO)")
    return parser.parse_args(argv)


def apply_overrides(config: Config, args: argparse.Namespace) -> Config:
    overrides = {}
    if args.host:
        overrides["host"] = args.host
    if args.port:
        overrides["port"] = args.port
    if args.engine:
        overrides["engine"] = args.engine
    if args.models_dir:
        overrides["models_dir"] = Path(args.models_dir).expanduser().resolve()
    return replace(config, **overrides) if overrides else config


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    config = apply_overrides(Config.from_env(), args)
    server, services = build_server(config)
    manager = services.manager

    def shutdown(*_: object) -> None:
        # serve_forever() runs on this thread, so shutdown() has to be asked for
        # from another one: calling it inside the handler would deadlock.
        logger.info("shutting down; stopping the served model")
        threading.Thread(target=server.shutdown, daemon=True).start()

    for received in (signal.SIGINT, signal.SIGTERM):
        signal.signal(received, shutdown)

    logger.info("engine=%s models_dir=%s", manager.engine.name, config.models_dir)
    logger.info("listening on http://%s:%s", config.host, config.port)
    try:
        server.serve_forever()
    finally:
        manager.shutdown()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
