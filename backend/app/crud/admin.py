from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, hash_refresh_token
from app.models.admin import Admin, RefreshToken


def get_by_username(db: Session, username: str) -> Admin | None:
    return db.query(Admin).filter(Admin.username == username).first()


def get_by_id(db: Session, admin_id: int) -> Admin | None:
    return db.get(Admin, admin_id)


def create(db: Session, username: str, password: str) -> Admin:
    admin = Admin(username=username, hashed_password=hash_password(password))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def create_refresh_token(db: Session, admin_id: int, raw_token: str) -> RefreshToken:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token = RefreshToken(
        admin_id=admin_id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def get_refresh_token(db: Session, raw_token: str) -> RefreshToken | None:
    return (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .first()
    )


def revoke_refresh_token(db: Session, token: RefreshToken) -> None:
    token.is_revoked = True
    db.commit()


def revoke_all_refresh_tokens(db: Session, admin_id: int) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.admin_id == admin_id,
        RefreshToken.is_revoked == False,  # noqa: E712
    ).update({"is_revoked": True})
    db.commit()
