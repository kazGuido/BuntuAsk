from fastapi.testclient import TestClient

from app.main import app
from app.middleware.basic_auth import is_basic_auth_exempt
from app.spa import inject_share_meta


def test_inject_share_meta_replaces_placeholders():
    html = '<meta property="og:url" content="{{PUBLIC_SITE_URL}}" /><meta property="og:image" content="{{OG_IMAGE_URL}}" />'
    out = inject_share_meta(html, public_site_url="https://demo.example.com")
    assert 'content="https://demo.example.com"' in out
    assert 'content="https://demo.example.com/og-image.png"' in out


client = TestClient(app)


def test_health_without_basic_auth():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root_html_without_basic_auth():
    response = client.get("/")
    assert response.status_code in (200, 404)


def test_protected_api_requires_basic_auth():
    response = client.get("/api/v1/projects")
    assert response.status_code == 401
    assert response.headers.get("www-authenticate", "").startswith("Basic")


def test_exempt_paths():
    assert is_basic_auth_exempt("GET", "/", "/api/v1/health")
    assert is_basic_auth_exempt("HEAD", "/", "/api/v1/health")
    assert is_basic_auth_exempt("GET", "/og-image.png", "/api/v1/health")
    assert is_basic_auth_exempt("GET", "/robots.txt", "/api/v1/health")
    assert is_basic_auth_exempt("GET", "/api/v1/health", "/api/v1/health")
    assert not is_basic_auth_exempt("GET", "/assets/index.js", "/api/v1/health")
