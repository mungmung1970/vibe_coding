"""Dependency-free HTTP layer: routing, JSON bodies, SSE streaming, static files."""

from __future__ import annotations

import json
import logging
import mimetypes
import re
import urllib.parse
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator

from .errors import ApiError

JSON_TYPE = "application/json; charset=utf-8"
MAX_BODY_BYTES = 4 * 1024 * 1024

logger = logging.getLogger("app.http")


@dataclass
class Request:
    method: str
    path: str
    query: dict[str, str]
    headers: dict[str, str]
    params: dict[str, str]
    body: bytes

    def json(self) -> dict:
        if not self.body:
            return {}
        try:
            payload = json.loads(self.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError(400, "invalid_json", f"요청 본문을 JSON으로 해석할 수 없습니다: {exc}") from exc
        if not isinstance(payload, dict):
            raise ApiError(400, "invalid_json", "요청 본문은 JSON 객체여야 합니다.")
        return payload


@dataclass
class Response:
    status: int = 200
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""
    stream: Iterator[bytes] | None = None


Handler = Callable[[Request], Any]


def json_response(payload: Any, status: int = 200) -> Response:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return Response(status=status, headers={"Content-Type": JSON_TYPE}, body=body)


def sse_response(events: Iterable[dict]) -> Response:
    """Wrap an event dict iterator as a text/event-stream response."""

    def encode() -> Iterator[bytes]:
        for event in events:
            name = event.get("type", "message")
            data = json.dumps(event, ensure_ascii=False)
            yield f"event: {name}\ndata: {data}\n\n".encode("utf-8")

    return Response(
        headers={
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
        stream=encode(),
    )


class Router:
    """Pattern router for paths such as ``/api/v1/runs/{run_id}``."""

    def __init__(self) -> None:
        self._routes: list[tuple[str, re.Pattern[str], Handler]] = []

    def add(self, method: str, pattern: str, handler: Handler) -> None:
        regex = re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern)
        self._routes.append((method.upper(), re.compile(f"^{regex}$"), handler))

    def get(self, pattern: str) -> Callable[[Handler], Handler]:
        return self._register("GET", pattern)

    def post(self, pattern: str) -> Callable[[Handler], Handler]:
        return self._register("POST", pattern)

    def delete(self, pattern: str) -> Callable[[Handler], Handler]:
        return self._register("DELETE", pattern)

    def _register(self, method: str, pattern: str) -> Callable[[Handler], Handler]:
        def decorator(handler: Handler) -> Handler:
            self.add(method, pattern, handler)
            return handler

        return decorator

    def resolve(self, method: str, path: str) -> tuple[Handler | None, dict[str, str], set[str]]:
        """Return the handler, its path params, and the methods allowed on the path."""
        allowed: set[str] = set()
        for route_method, regex, handler in self._routes:
            match = regex.match(path)
            if not match:
                continue
            allowed.add(route_method)
            if route_method == method.upper():
                return handler, match.groupdict(), allowed
        return None, {}, allowed


class StaticFiles:
    """Serves the frontend directory, with ``index.html`` as the directory default."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def resolve(self, path: str) -> Path | None:
        if not self.root.is_dir():
            return None
        relative = urllib.parse.unquote(path).lstrip("/") or "index.html"
        candidate = (self.root / relative).resolve()
        if not candidate.is_relative_to(self.root.resolve()):
            return None
        if candidate.is_dir():
            candidate = candidate / "index.html"
        return candidate if candidate.is_file() else None

    def response(self, path: str) -> Response | None:
        target = self.resolve(path)
        if target is None:
            return None
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {"application/javascript", "application/json"}:
            content_type = f"{content_type}; charset=utf-8"
        return Response(
            headers={"Content-Type": content_type, "Cache-Control": "no-cache"},
            body=target.read_bytes(),
        )


def create_handler_class(router: Router, static: StaticFiles | None):
    class RequestHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "ModelTest/1.0"

        def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
            self._dispatch("GET")

        def do_POST(self) -> None:  # noqa: N802
            self._dispatch("POST")

        def do_PUT(self) -> None:  # noqa: N802
            self._dispatch("PUT")

        def do_DELETE(self) -> None:  # noqa: N802
            self._dispatch("DELETE")

        def do_OPTIONS(self) -> None:  # noqa: N802
            self._send(Response(status=204))

        def log_message(self, fmt: str, *args: Any) -> None:
            logger.debug("%s - %s", self.address_string(), fmt % args)

        def _dispatch(self, method: str) -> None:
            parsed = urllib.parse.urlsplit(self.path)
            try:
                response = self._route(method, parsed)
            except ApiError as error:
                response = json_response(error.to_dict(), status=error.status)
            except Exception:  # pragma: no cover - defensive guard
                logger.exception("unhandled error while serving %s %s", method, parsed.path)
                response = json_response(
                    {"error": {"code": "internal_error", "message": "서버 내부 오류가 발생했습니다."}},
                    status=500,
                )
            self._send(response)

        def _route(self, method: str, parsed: urllib.parse.SplitResult) -> Response:
            handler, params, allowed = router.resolve(method, parsed.path)
            if handler is None:
                if allowed:
                    raise ApiError(405, "method_not_allowed", f"{method}는 이 경로에서 지원하지 않습니다.")
                if method == "GET" and static is not None:
                    static_response = static.response(parsed.path)
                    if static_response is not None:
                        return static_response
                raise ApiError(404, "not_found", f"{parsed.path} 경로를 찾을 수 없습니다.")

            request = Request(
                method=method,
                path=parsed.path,
                query={key: values[-1] for key, values in urllib.parse.parse_qs(parsed.query).items()},
                headers={key.lower(): value for key, value in self.headers.items()},
                params=params,
                body=self._read_body(),
            )
            result = handler(request)
            if isinstance(result, Response):
                return result
            if result is None:
                return Response(status=204)
            return json_response(result)

        def _read_body(self) -> bytes:
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise ApiError(400, "invalid_length", "Content-Length 헤더가 올바르지 않습니다.")
            if length > MAX_BODY_BYTES:
                raise ApiError(413, "payload_too_large", "요청 본문이 너무 큽니다.")
            return self.rfile.read(length) if length > 0 else b""

        def _send(self, response: Response) -> None:
            headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                **response.headers,
            }
            try:
                if response.stream is None:
                    self.send_response(response.status)
                    for key, value in headers.items():
                        self.send_header(key, value)
                    self.send_header("Content-Length", str(len(response.body)))
                    self.end_headers()
                    if self.command != "HEAD":
                        self.wfile.write(response.body)
                    return
                self._send_chunked(response, headers)
            except (BrokenPipeError, ConnectionResetError):
                logger.debug("client disconnected during %s %s", self.command, self.path)

        def _send_chunked(self, response: Response, headers: dict[str, str]) -> None:
            self.send_response(response.status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            assert response.stream is not None
            for chunk in response.stream:
                if not chunk:
                    continue
                self.wfile.write(f"{len(chunk):X}\r\n".encode("ascii") + chunk + b"\r\n")
                self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()

    return RequestHandler


def create_server(host: str, port: int, router: Router, static: StaticFiles | None = None) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), create_handler_class(router, static))
    server.daemon_threads = True
    return server
