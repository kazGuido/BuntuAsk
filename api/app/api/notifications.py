from datetime import datetime
from email.message import EmailMessage
import json
import smtplib
from typing import Annotated, Any

import redis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import get_current_user, require_admin
from app.api.schemas import (
    NotificationDeliveryRead,
    NotificationRead,
    NotificationSendRequest,
)
from app.core.config import get_settings
from app.db.session import get_session
from app.models import (
    AuditAction,
    Notification,
    NotificationChannel,
    NotificationDelivery,
    NotificationDeliveryStatus,
    User,
)


router = APIRouter(prefix="/notifications", tags=["notifications"])


def serialize_notification(notification: Notification) -> NotificationRead:
    return NotificationRead(
        id=notification.id or 0,
        title=notification.title,
        body=notification.body,
        category=notification.category,
        metadata=notification.metadata_json,
        is_read=notification.is_read,
        created_at=notification.created_at.isoformat(),
        read_at=notification.read_at.isoformat() if notification.read_at else None,
        deliveries=[
            NotificationDeliveryRead(
                id=delivery.id or 0,
                channel=delivery.channel,
                status=delivery.status,
                destination=delivery.destination,
                error_message=delivery.error_message,
            )
            for delivery in notification.deliveries
        ],
    )


def build_email_message(*, to_email: str, subject: str, body: str, from_email: str) -> EmailMessage:
    message = EmailMessage()
    message["To"] = to_email
    message["From"] = from_email
    message["Subject"] = subject
    message.set_content(body)
    return message


def deliver_whatsapp(delivery: NotificationDelivery, user: User, notification: Notification) -> None:
    settings = get_settings()
    if not user.whatsapp_number:
        delivery.status = NotificationDeliveryStatus.SKIPPED
        delivery.error_message = "User has no WhatsApp number"
        return

    publisher = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    publisher.publish(
        "whatsapp_outbound",
        json.dumps({
            "phone": user.whatsapp_number,
            "message": f"{notification.title}\n\n{notification.body}",
        }),
    )
    delivery.destination = user.whatsapp_number
    delivery.status = NotificationDeliveryStatus.QUEUED


def deliver_email(delivery: NotificationDelivery, user: User, notification: Notification) -> None:
    settings = get_settings()
    from_email = settings.smtp_from_email or settings.smtp_username
    if not settings.smtp_host or not from_email:
        delivery.status = NotificationDeliveryStatus.SKIPPED
        delivery.error_message = "SMTP is not configured"
        return
    if not user.email:
        delivery.status = NotificationDeliveryStatus.SKIPPED
        delivery.error_message = "User has no email address"
        return

    message = build_email_message(
        to_email=user.email,
        subject=notification.title,
        body=notification.body,
        from_email=from_email,
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    delivery.destination = user.email
    delivery.status = NotificationDeliveryStatus.SENT


def create_notification(
    session: Session,
    *,
    user: User,
    title: str,
    body: str,
    channels: list[NotificationChannel],
    category: str = "GENERAL",
    metadata: dict[str, Any] | None = None,
) -> Notification:
    normalized_channels = list(dict.fromkeys(channels or [NotificationChannel.IN_APP]))
    if NotificationChannel.IN_APP not in normalized_channels:
        normalized_channels.insert(0, NotificationChannel.IN_APP)

    notification = Notification(
        user_id=user.id or 0,
        title=title,
        body=body,
        category=category,
        metadata_json=metadata or {},
    )
    session.add(notification)
    session.flush()

    for channel in normalized_channels:
        delivery = NotificationDelivery(
            notification_id=notification.id or 0,
            channel=channel,
            status=NotificationDeliveryStatus.SENT if channel == NotificationChannel.IN_APP else NotificationDeliveryStatus.QUEUED,
            destination="in-app" if channel == NotificationChannel.IN_APP else None,
            attempted_at=datetime.utcnow(),
        )
        session.add(delivery)
        session.flush()
        if channel == NotificationChannel.WHATSAPP:
            try:
                deliver_whatsapp(delivery, user, notification)
            except Exception as exc:  # pragma: no cover - depends on Redis availability
                delivery.status = NotificationDeliveryStatus.FAILED
                delivery.error_message = str(exc)
        elif channel == NotificationChannel.EMAIL:
            try:
                deliver_email(delivery, user, notification)
            except Exception as exc:  # pragma: no cover - depends on SMTP availability
                delivery.status = NotificationDeliveryStatus.FAILED
                delivery.error_message = str(exc)
        session.add(delivery)

    return notification


def notify_user_id(
    session: Session,
    *,
    user_id: int,
    title: str,
    body: str,
    channels: list[NotificationChannel] | None = None,
    category: str = "GENERAL",
    metadata: dict[str, Any] | None = None,
) -> Notification | None:
    user = session.get(User, user_id)
    if user is None:
        return None
    return create_notification(
        session,
        user=user,
        title=title,
        body=body,
        channels=channels or [NotificationChannel.IN_APP],
        category=category,
        metadata=metadata,
    )


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    include_read: bool = True,
) -> list[NotificationRead]:
    statement = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.id.desc()).limit(100)
    if not include_read:
        statement = statement.where(Notification.is_read == False)  # noqa: E712
    notifications = session.exec(statement).all()
    return [serialize_notification(notification) for notification in notifications]


@router.get("/unread-count")
def unread_count(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, int]:
    count = session.exec(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    ).one()
    return {"count": int(count)}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    notification = session.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        session.add(notification)
        write_audit(
            session,
            action=AuditAction.NOTIFICATION_READ,
            actor=current_user,
            target_user_id=current_user.id,
            entity_type="notification",
            entity_id=notification.id,
            description=f"Notification {notification.id} marked read.",
            ip_address=request.client.host if request.client else None,
        )
        session.commit()
    return {"status": "read"}


@router.post("/admin/send", response_model=list[NotificationRead])
def admin_send_notification(
    payload: NotificationSendRequest,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[NotificationRead]:
    users = session.exec(select(User).where(User.id.in_(payload.user_ids), User.is_active == True)).all()  # noqa: E712
    found_ids = {user.id for user in users}
    missing_ids = set(payload.user_ids).difference(found_ids)
    if missing_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Active users not found: {sorted(missing_ids)}")

    notifications = [
        create_notification(
            session,
            user=user,
            title=payload.title,
            body=payload.body,
            channels=payload.channels,
            category=payload.category,
            metadata=payload.metadata,
        )
        for user in users
    ]
    for notification in notifications:
        write_audit(
            session,
            action=AuditAction.NOTIFICATION_SENT,
            actor=admin_user,
            target_user_id=notification.user_id,
            entity_type="notification",
            entity_id=notification.id,
            description=f"Notification {notification.id} sent by admin {admin_user.username}.",
            metadata={"channels": [channel.value for channel in payload.channels], "category": payload.category},
            ip_address=request.client.host if request.client else None,
        )
    session.commit()
    for notification in notifications:
        session.refresh(notification)
    return [serialize_notification(notification) for notification in notifications]
