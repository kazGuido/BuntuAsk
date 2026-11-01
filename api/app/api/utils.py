from datetime import date, datetime, timezone
from typing import Any

from fastapi import Request

from app.models import User


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


def record_task_completion(user: User, now: datetime | None = None) -> None:
    moment = now or utc_now()
    today = moment.date()
    user.tasks_completed_count += 1
    if user.last_active_date == today:
        pass
    elif user.last_active_date == today.fromordinal(today.toordinal() - 1):
        user.current_streak = max(1, user.current_streak + 1)
    else:
        user.current_streak = 1
    user.last_active_date = today
    user.trust_score = min(100.0, user.trust_score + 0.5)
