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
from .services.history import HistoryStore
from .services.inference import InferenceService
from .services.judge import JudgeService
from .services.media import MediaService, MediaStore
from .services.model_registry import ModelRegistry
from .services.parameter_catalog import ParameterCatalog
from .services.secrets import load_secrets

logger = logging.getLogger("app")


@dataclass
class Services:
    """Every long-lived object the server needs, wired together."""

    config: Config
    registry: ModelRegistry
    catalog: ParameterCatalog
    history: HistoryStore
    inference: InferenceService
    judge: JudgeService
    media: MediaService
    router: Router


def build_services(config: Config) -> Services:
    load_secrets(config.secrets_file)
    registry = ModelRegistry(config.models_dir)
    catalog = ParameterCatalog(config.parameters_file)
    history = HistoryStore(config.history_file, config.history_limit)
    inference = InferenceService(config, catalog, registry, history)
    judge = JudgeService(config, registry)
    media = MediaService(config, registry, catalog, MediaStore(config.media_dir, config.media_limit))
    router = build_router(config, registry, catalog, inference, history, judge, media)
    return Services(config, registry, catalog, history, inference, judge, media, router)


def build_server(config: Config) -> tuple[ThreadingHTTPServer, Services]:
    services = build_services(config)
    static = StaticFiles(config.frontend_dir)
    return create_server(config.host, config.port, services.router, static), services


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="app-backend", description="Reusable application backend")
    parser.add_argument("--host", help="바인딩 주소 (기본 127.0.0.1)")
    parser.add_argument("--port", type=int, help="바인딩 포트 (기본 8080)")
    parser.add_argument("--models-dir", help="모델 디렉터리 경로")
    parser.add_argument("--log-level", default="INFO", help="로그 레벨 (기본 INFO)")
    return parser.parse_args(argv)


def apply_overrides(config: Config, args: argparse.Namespace) -> Config:
    overrides = {}
    if args.host:
        overrides["host"] = args.host
    if args.port:
        overrides["port"] = args.port
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

    def shutdown(*_: object) -> None:
        # serve_forever() runs on this thread, so shutdown() has to be asked for
        # from another one: calling it inside the handler would deadlock.
        logger.info("shutting down")
        threading.Thread(target=server.shutdown, daemon=True).start()

    for received in (signal.SIGINT, signal.SIGTERM):
        signal.signal(received, shutdown)

    models = services.registry.list()
    logger.info("models=%d models_dir=%s", len(models), config.models_dir)
    for model in models:
        ready = "" if model.key_ready else "  (API 키 없음)"
        logger.info("  %-22s %s%s", model.id, model.base_url, ready)
    logger.info("listening on http://%s:%s", config.host, config.port)
    try:
        server.serve_forever()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
