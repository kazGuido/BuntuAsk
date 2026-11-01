from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import get_current_user
from app.api.notifications import create_notification
from app.api.schemas import TokenResponse, UserCreate, UserLogin, UserRead
from app.api.security import create_access_token, hash_password, verify_password
from app.api.utils import client_ip
from app.db.session import get_session
from app.models import AuditAction, NotificationChannel, User, UserRole


router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user(user: User) -> UserRead:
    return UserRead(
        id=user.id or 0,
        username=user.username,
        email=user.email,
        whatsapp_number=user.whatsapp_number,
        role=user.role,
        wallet_balance=user.wallet_balance,
        is_active=user.is_active,
        trust_score=user.trust_score,
        onboarding_completed=user.onboarding_completed_at is not None,
        tasks_completed_count=user.tasks_completed_count,
        current_streak=user.current_streak,
    )


@router.post("/register", response_model=TokenResponse)
def register(
    payload: UserCreate,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    existing = session.exec(
        select(User).where(or_(User.username == payload.username, User.email == payload.email))
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        whatsapp_number=payload.whatsapp_number,
        password_hash=hash_password(payload.password),
        role=UserRole.ANNOTATOR,
        trust_score=50.0,
    )
    session.add(user)
    session.flush()
    write_audit(
        session,
        action=AuditAction.USER_REGISTERED,
        actor=user,
        target_user_id=user.id,
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.username} registered as ANNOTATOR.",
        ip_address=client_ip(request),
    )
    create_notification(
        session,
        user=user,
        title="Welcome to BuntuAsk",
        body="Your account is ready. Complete the short tour, then start your first paid task.",
        channels=[NotificationChannel.IN_APP],
        category="ACCOUNT",
        metadata={"event": "user_registered"},
    )
    session.commit()
    session.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id)), user=serialize_user(user))


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    user = session.exec(
        select(User).where(or_(User.username == payload.username_or_email, User.email == payload.username_or_email))
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    write_audit(
        session,
        action=AuditAction.USER_LOGIN,
        actor=user,
        target_user_id=user.id,
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.username} logged in.",
        ip_address=client_ip(request),
    )
    session.commit()
    return TokenResponse(access_token=create_access_token(str(user.id)), user=serialize_user(user))


@router.get("/me", response_model=UserRead)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    return serialize_user(current_user)


@router.post("/onboarding/complete", response_model=UserRead)
def complete_onboarding(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> UserRead:
    if current_user.onboarding_completed_at is None:
        current_user.onboarding_completed_at = datetime.utcnow()
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
    return serialize_user(current_user)
