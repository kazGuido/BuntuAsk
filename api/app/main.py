from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import admin, auth, reviews, storage, tasks, whatsapp
from app.core.config import get_settings


settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(tasks.router, prefix=settings.api_v1_prefix)
app.include_router(reviews.router, prefix=settings.api_v1_prefix)
app.include_router(storage.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(whatsapp.router, prefix=settings.api_v1_prefix)


@app.get(f"{settings.api_v1_prefix}/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def mount_frontend_assets(frontend_dist_dir: Path) -> None:
    assets_dir = frontend_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


mount_frontend_assets(settings.frontend_dist_dir)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str) -> FileResponse:
    if full_path.startswith(settings.api_v1_prefix.lstrip("/")):
        raise HTTPException(status_code=404, detail="API route not found")

    index_path = settings.frontend_dist_dir / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")

    return FileResponse(index_path)
