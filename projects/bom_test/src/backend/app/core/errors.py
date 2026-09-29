"""Error type shared by every API handler."""

from __future__ import annotations

from typing import Any


class ApiError(Exception):
    """An error that maps directly onto an HTTP status and a JSON body."""

    def __init__(self, status: int, code: str, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details

    def to_dict(self) -> dict:
        error: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details is not None:
            error["details"] = self.details
        return {"error": error}
