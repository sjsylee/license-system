from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.client_ip import get_client_ip
from app.core.config import settings
from app.core.rate_limit import login_rate_limiter
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    verify_password,
)
from app.crud import admin as crud_admin
from app.dependencies import get_db
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["인증"])

LOGIN_IP_LIMIT = 20
LOGIN_IP_WINDOW_SECONDS = 300
LOGIN_USER_LIMIT = 10
LOGIN_USER_WINDOW_SECONDS = 600
LOGIN_PAIR_LIMIT = 8
LOGIN_PAIR_WINDOW_SECONDS = 600

REFRESH_COOKIE = "refresh_token"
COOKIE_OPTS = {
    "key": REFRESH_COOKIE,
    "httponly": True,
    "secure": True,
    "samesite": "strict",
    "max_age": settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    "path": "/auth",
}


def _login_limit_keys(client_ip: str, username: str) -> tuple[str, str, str]:
    normalized_username = username.strip().lower()
    return (
        f"login:ip:{client_ip}",
        f"login:user:{normalized_username}",
        f"login:pair:{client_ip}:{normalized_username}",
    )


def _enforce_login_rate_limit(client_ip: str, username: str) -> None:
    ip_key, user_key, pair_key = _login_limit_keys(client_ip, username)
    checks = (
        login_rate_limiter.is_limited(ip_key, LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_SECONDS),
        login_rate_limiter.is_limited(user_key, LOGIN_USER_LIMIT, LOGIN_USER_WINDOW_SECONDS),
        login_rate_limiter.is_limited(pair_key, LOGIN_PAIR_LIMIT, LOGIN_PAIR_WINDOW_SECONDS),
    )
    limited_retry_after = max((retry_after for limited, retry_after in checks if limited), default=0)
    if limited_retry_after > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(limited_retry_after)},
        )


def _record_login_failure(client_ip: str, username: str) -> None:
    ip_key, user_key, pair_key = _login_limit_keys(client_ip, username)
    login_rate_limiter.hit(ip_key, LOGIN_IP_WINDOW_SECONDS)
    login_rate_limiter.hit(user_key, LOGIN_USER_WINDOW_SECONDS)
    login_rate_limiter.hit(pair_key, LOGIN_PAIR_WINDOW_SECONDS)


def _reset_login_success_state(client_ip: str, username: str) -> None:
    _, user_key, pair_key = _login_limit_keys(client_ip, username)
    login_rate_limiter.reset(user_key)
    login_rate_limiter.reset(pair_key)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="어드민 로그인",
    description=(
        "어드민 계정으로 로그인합니다.\n\n"
        "- **Access Token** (30분 유효)을 응답 본문으로 반환합니다.\n"
        "- **Refresh Token** (7일 유효)은 `httpOnly` 쿠키(`refresh_token`)로 자동 설정됩니다.\n"
        "- Refresh Token은 JS에서 접근할 수 없어 XSS 공격으로부터 보호됩니다."
    ),
    response_description="발급된 Access Token",
)
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    _enforce_login_rate_limit(client_ip, body.username)

    admin = crud_admin.get_by_username(db, body.username)
    if not admin or not verify_password(body.password, admin.hashed_password):
        _record_login_failure(client_ip, body.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not admin.is_active:
        _record_login_failure(client_ip, body.username)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    _reset_login_success_state(client_ip, body.username)
    raw_token = generate_refresh_token()
    crud_admin.create_refresh_token(db, admin.id, raw_token)

    response.set_cookie(value=raw_token, **COOKIE_OPTS)
    return TokenResponse(access_token=create_access_token(admin.id))


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Access Token 재발급",
    description=(
        "쿠키의 Refresh Token을 사용해 새 Access Token을 발급합니다.\n\n"
        "- **Refresh Token Rotation**: 매 요청마다 Refresh Token도 새로 교체됩니다.\n"
        "- 이미 사용된 Refresh Token으로 재요청하면 토큰 탈취로 간주하여 "
        "해당 어드민의 **모든 Refresh Token을 즉시 폐기**합니다."
    ),
    response_description="새로 발급된 Access Token",
)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    token_record = crud_admin.get_refresh_token(db, raw_token)
    if (
        not token_record
        or token_record.is_revoked
        or token_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    ):
        if token_record:
            crud_admin.revoke_all_refresh_tokens(db, token_record.admin_id)
        response.delete_cookie(REFRESH_COOKIE, path="/auth")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    crud_admin.revoke_refresh_token(db, token_record)
    new_raw = generate_refresh_token()
    crud_admin.create_refresh_token(db, token_record.admin_id, new_raw)

    response.set_cookie(value=new_raw, **COOKIE_OPTS)
    return TokenResponse(access_token=create_access_token(token_record.admin_id))


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="로그아웃",
    description=(
        "현재 Refresh Token을 폐기하고 쿠키를 삭제합니다.\n\n"
        "클라이언트는 메모리에 보관 중인 Access Token도 함께 제거해야 합니다."
    ),
)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if raw_token:
        token_record = crud_admin.get_refresh_token(db, raw_token)
        if token_record:
            crud_admin.revoke_refresh_token(db, token_record)
    response.delete_cookie(REFRESH_COOKIE, path="/auth")
