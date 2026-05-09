from typing import Annotated, Any

import httpx
import redis
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.api.schemas import WhatsAppSendRequest
from app.core.config import get_settings
from app.models import User


router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/status")
async def whatsapp_status(_admin: Annotated[User, Depends(require_admin)]) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.whatsapp_sidecar_url}/wa/status")
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="WhatsApp sidecar unavailable")
    return response.json()


@router.get("/qr")
async def whatsapp_qr(_admin: Annotated[User, Depends(require_admin)]) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.whatsapp_sidecar_url}/wa/qr")
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="WhatsApp sidecar unavailable")
    return response.json()


@router.post("/send")
def whatsapp_send(payload: WhatsAppSendRequest, _admin: Annotated[User, Depends(require_admin)]) -> dict[str, str]:
    settings = get_settings()
    publisher = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    publisher.publish("whatsapp_outbound", payload.model_dump_json())
    return {"status": "queued"}
