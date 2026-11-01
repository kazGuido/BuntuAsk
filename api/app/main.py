from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api import admin, auth, notifications, projects, reviews, storage, tasks, whatsapp
from app.api.bootstrap import bootstrap_admin
from app.core.config import get_settings
from app.middleware.basic_auth import BasicAuthMiddleware
from app.spa import og_image_response, robots_txt, serve_index_html


settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(projects.router, prefix=settings.api_v1_prefix)
app.include_router(tasks.router, prefix=settings.api_v1_prefix)
app.include_router(reviews.router, prefix=settings.api_v1_prefix)
app.include_router(storage.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(whatsapp.router, prefix=settings.api_v1_prefix)
app.include_router(notifications.router, prefix=settings.api_v1_prefix)

app.add_middleware(
    BasicAuthMiddleware,
    enabled=settings.basic_auth_enabled,
    username=settings.basic_auth_user,
    password=settings.basic_auth_password,
    api_health_path=f"{settings.api_v1_prefix}/health",
)


@app.on_event("startup")
def on_startup() -> None:
    bootstrap_admin(settings)


@app.get(f"{settings.api_v1_prefix}/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/robots.txt", include_in_schema=False)
def serve_robots() -> Response:
    return robots_txt()


@app.get("/og-image.png", include_in_schema=False)
def serve_og_image() -> FileResponse:
    image_path = settings.frontend_dist_dir / "og-image.png"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="OG image not found")
    return og_image_response(settings.frontend_dist_dir)


def mount_frontend_assets(frontend_dist_dir: Path) -> None:
    assets_dir = frontend_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


mount_frontend_assets(settings.frontend_dist_dir)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str) -> Response:
    if full_path.startswith(settings.api_v1_prefix.lstrip("/")):
        raise HTTPException(status_code=404, detail="API route not found")

    index_path = settings.frontend_dist_dir / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")

    return serve_index_html(settings.frontend_dist_dir, public_site_url=settings.public_site_url)
