from pathlib import Path

from fastapi.responses import FileResponse, PlainTextResponse, Response


def robots_txt() -> PlainTextResponse:
    return PlainTextResponse("User-agent: *\nAllow: /\n")


def inject_share_meta(html: str, *, public_site_url: str | None) -> str:
    site = (public_site_url or "").rstrip("/")
    og_url = site or "{{PUBLIC_SITE_URL}}"
    og_image = f"{site}/og-image.png" if site else "/og-image.png"

    html = html.replace('content="{{PUBLIC_SITE_URL}}"', f'content="{og_url}"')
    html = html.replace('content="{{OG_IMAGE_URL}}"', f'content="{og_image}"')
    return html


def serve_index_html(frontend_dist_dir: Path, *, public_site_url: str | None) -> Response:
    index_path = frontend_dist_dir / "index.html"
    html = index_path.read_text(encoding="utf-8")
    body = inject_share_meta(html, public_site_url=public_site_url)
    return Response(content=body, media_type="text/html")


def og_image_response(frontend_dist_dir: Path) -> FileResponse:
    image_path = frontend_dist_dir / "og-image.png"
    return FileResponse(image_path, media_type="image/png")
