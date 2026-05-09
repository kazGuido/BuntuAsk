from datetime import datetime, timezone
from typing import Any

from fastapi import Request


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def payload_text(payload: dict[str, Any]) -> str:
    for key in ("text", "prompt", "translation", "answer", "content", "kirundi", "french"):
        value = payload.get(key)
        if isinstance(value, str):
            return value
    return " ".join(str(value) for value in payload.values() if isinstance(value, str))
