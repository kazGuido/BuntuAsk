from sqlalchemy import or_
from sqlmodel import Session, select

from app.api.security import hash_password
from app.core.config import Settings
from app.db.session import engine
from app.models import User, UserRole


def bootstrap_admin(settings: Settings) -> None:
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        return

    username = settings.bootstrap_admin_username or settings.bootstrap_admin_email.split("@", 1)[0]
    with Session(engine) as session:
        user = session.exec(
            select(User).where(or_(User.email == settings.bootstrap_admin_email, User.username == username))
        ).first()
        if user is None:
            user = User(
                username=username,
                email=settings.bootstrap_admin_email,
                whatsapp_number=settings.bootstrap_admin_whatsapp,
                password_hash=hash_password(settings.bootstrap_admin_password),
                role=UserRole.ADMIN,
            )
        else:
            user.role = UserRole.ADMIN
            user.is_active = True
        session.add(user)
        session.commit()
