from typing import Annotated

import boto3
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.schemas import StorageUrlRequest, StorageUrlResponse
from app.core.config import get_settings
from app.models import User


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


@router.get("/upload-url", response_model=StorageUrlResponse)
def upload_url(
    key: str,
    content_type: str = "application/octet-stream",
    expires_in: int = 3600,
    _current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StorageUrlResponse:
    settings = get_settings()
    url = s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )
    return StorageUrlResponse(url=url, key=key)


@router.get("/download-url", response_model=StorageUrlResponse)
def download_url(
    key: str,
    expires_in: int = 3600,
    _current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StorageUrlResponse:
    settings = get_settings()
    url = s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )
    return StorageUrlResponse(url=url, key=key)
