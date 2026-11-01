import base64
import secrets
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


def _normalize_path(path: str) -> str:
    if not path or path == "/":
        return "/"
    return path.rstrip("/") or "/"


def is_basic_auth_exempt(method: str, path: str, api_health_path: str) -> bool:
    normalized = _normalize_path(path)
    if normalized == _normalize_path(api_health_path):
        return True
    if normalized in ("/og-image.png", "/robots.txt"):
        return True
    if method in ("GET", "HEAD") and normalized == "/":
        return True
    return False


class BasicAuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        enabled: bool,
        username: str,
        password: str,
        api_health_path: str,
    ) -> None:
        super().__init__(app)
        self.enabled = enabled
        self.username = username
        self.password = password
        self.api_health_path = api_health_path

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        if is_basic_auth_exempt(request.method, request.url.path, self.api_health_path):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Basic "):
            try:
                decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
                user, _, pwd = decoded.partition(":")
                if secrets.compare_digest(user, self.username) and secrets.compare_digest(pwd, self.password):
                    return await call_next(request)
            except (ValueError, UnicodeDecodeError):
                pass

        return Response(
            content="Authentication required",
            status_code=401,
            headers={"WWW-Authenticate": 'Basic realm="BuntuAsk demo"'},
        )
