"""진입점. 정적 프론트엔드와 API를 같은 포트에서 서빙한다."""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import threading
from dataclasses import replace

from .api.routes import build_router
from .config import Config
from .core.http import StaticFiles, create_server
from .services import extract as extract_service
from .services.secrets import load_secrets

logger = logging.getLogger("app")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="bom-test", description="BOM 기본정보 추출 콘솔")
    parser.add_argument("--host")
    parser.add_argument("--port", type=int)
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args(argv if argv is not None else sys.argv[1:])
    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO),
                        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")

    config = Config.from_env()
    overrides = {name: value for name, value in (("host", args.host), ("port", args.port)) if value}
    config = replace(config, **overrides) if overrides else config

    load_secrets(config.secrets_file)
    server = create_server(config.host, config.port, build_router(config), StaticFiles(config.frontend_dir))

    def shutdown(*_: object) -> None:
        # serve_forever()가 이 스레드를 잡고 있어 shutdown()은 다른 스레드에서 불러야 한다.
        logger.info("shutting down")
        threading.Thread(target=server.shutdown, daemon=True).start()

    for received in (signal.SIGINT, signal.SIGTERM):
        signal.signal(received, shutdown)

    try:
        base_url, remote_model, _ = extract_service.endpoint()
        logger.info("model=%s remote=%s base_url=%s", extract_service.MODEL_ID, remote_model, base_url)
    except Exception as exc:  # 설정이 비어도 화면은 떠야 한다
        logger.warning("endpoint not ready: %s", exc)
    logger.info("listening on http://%s:%s", config.host, config.port)
    try:
        server.serve_forever()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
