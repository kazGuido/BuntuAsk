from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BuntuAsk"
    api_v1_prefix: str = "/api/v1"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60 * 24

    database_url: str = "postgresql+psycopg://buntu:buntu_dev_password@db:5432/buntuask"
    redis_url: str = "redis://cache:6379/0"

    s3_endpoint_url: str = "http://storage:9000"
    s3_public_endpoint_url: str = "http://localhost:9000"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket_name: str = "buntu-media"

    frontend_dist_dir: Path = Path("/app/frontend_dist")
    whatsapp_sidecar_url: str = "http://whatsapp_sidecar:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
