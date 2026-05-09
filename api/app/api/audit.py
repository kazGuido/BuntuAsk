from typing import Any

from sqlmodel import Session

from app.models import AuditAction, AuditLog, User


def write_audit(
    session: Session,
    *,
    action: AuditAction,
    entity_type: str,
    description: str,
    actor: User | None = None,
    actor_id: int | None = None,
    target_user_id: int | None = None,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    log = AuditLog(
        actor_id=actor.id if actor is not None else actor_id,
        target_user_id=target_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        metadata_json=metadata or {},
        ip_address=ip_address,
    )
    session.add(log)
    return log
