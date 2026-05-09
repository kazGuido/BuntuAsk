from typing import Annotated

import boto3
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.schemas import StorageUrlRequest, StorageUrlResponse
from app.core.config import get_settings
from app.models import User, UserRole


router = APIRouter(prefix="/storage", tags=["storage"])


def s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_public_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name="us-east-1",
    )


def authorize_storage_key(user: User, key: str) -> str:
    normalized = key.strip().lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage key")
    if user.role == UserRole.ADMIN:
        return normalized
    allowed_prefix = f"users/{user.id}/"
    if not normalized.startswith(allowed_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Storage key must live under {allowed_prefix}",
        )
    return normalized


@router.get("/upload-url", response_model=StorageUrlResponse)
def upload_url(
    key: str,
    content_type: str = "application/octet-stream",
    expires_in: int = 3600,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StorageUrlResponse:
    settings = get_settings()
    authorized_key = authorize_storage_key(current_user, key)
    url = s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": authorized_key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )
    return StorageUrlResponse(url=url, key=authorized_key)


@router.get("/download-url", response_model=StorageUrlResponse)
def download_url(
    key: str,
    expires_in: int = 3600,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StorageUrlResponse:
    settings = get_settings()
    authorized_key = authorize_storage_key(current_user, key)
    url = s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": authorized_key},
        ExpiresIn=expires_in,
    )
    return StorageUrlResponse(url=url, key=authorized_key)
