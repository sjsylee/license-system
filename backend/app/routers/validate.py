from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.client_ip import get_client_ip
from app.core.rate_limit import validate_rate_limiter
from app.crud import license as crud_license
from app.crud import program as crud_program
from app.dependencies import get_db
from app.schemas.validate import ValidateRequest, ValidateResponse

router = APIRouter(prefix="/v1", tags=["라이선스 검증"])

VALIDATE_IP_LIMIT = 120
VALIDATE_IP_WINDOW_SECONDS = 60
VALIDATE_KEY_LIMIT = 30
VALIDATE_KEY_WINDOW_SECONDS = 60
VALIDATE_PAIR_LIMIT = 20
VALIDATE_PAIR_WINDOW_SECONDS = 60

_CAST = {
    "int": int,
    "float": float,
    "bool": lambda v: v.lower() in ("true", "1", "yes"),
    "str": str,
}


def _validate_limit_keys(client_ip: str, license_key: str) -> tuple[str, str, str]:
    normalized_key = license_key.strip().upper()
    return (
        f"validate:ip:{client_ip}",
        f"validate:key:{normalized_key}",
        f"validate:pair:{client_ip}:{normalized_key}",
    )


def _is_validate_rate_limited(client_ip: str, license_key: str) -> bool:
    ip_key, license_limit_key, pair_key = _validate_limit_keys(client_ip, license_key)
    checks = (
        validate_rate_limiter.is_limited(ip_key, VALIDATE_IP_LIMIT, VALIDATE_IP_WINDOW_SECONDS),
        validate_rate_limiter.is_limited(license_limit_key, VALIDATE_KEY_LIMIT, VALIDATE_KEY_WINDOW_SECONDS),
        validate_rate_limiter.is_limited(pair_key, VALIDATE_PAIR_LIMIT, VALIDATE_PAIR_WINDOW_SECONDS),
    )
    return any(limited for limited, _ in checks)


def _record_validate_attempt(client_ip: str, license_key: str) -> None:
    ip_key, license_limit_key, pair_key = _validate_limit_keys(client_ip, license_key)
    validate_rate_limiter.hit(ip_key, VALIDATE_IP_WINDOW_SECONDS)
    validate_rate_limiter.hit(license_limit_key, VALIDATE_KEY_WINDOW_SECONDS)
    validate_rate_limiter.hit(pair_key, VALIDATE_PAIR_WINDOW_SECONDS)


def _rate_limited_response() -> ValidateResponse:
    return ValidateResponse(valid=False, error_code="rate_limited")


def _public_validate_error_code(error_code: str) -> str:
    if error_code in {"program_not_found", "license_not_found", "program_mismatch"}:
        return "invalid_license"
    if error_code in {"license_inactive", "license_expired"}:
        return "license_unusable"
    return error_code


def _invalid_validate_response(client_ip: str, license_key: str, error_code: str) -> ValidateResponse:
    _record_validate_attempt(client_ip, license_key)
    return ValidateResponse(valid=False, error_code=_public_validate_error_code(error_code))


@router.post(
    "/validate",
    response_model=ValidateResponse,
    summary="라이선스 검증",
    description=(
        "Electron 앱 시작 시 호출하는 엔드포인트입니다. **인증 불필요**.\n\n"
        "### 검증 순서\n"
        "1. `program_name`으로 프로그램 존재 확인\n"
        "2. `license_key`로 라이선스 조회\n"
        "3. 라이선스가 해당 프로그램 소속인지 확인\n"
        "4. 활성화 여부 및 만료일 확인\n"
        "5. `hwid` 기기 등록 여부 확인\n"
        "   - 등록된 기기 → `last_seen_at` 갱신\n"
        "   - 신규 기기 → `max_devices` 초과 시 거부, 여유 있으면 자동 등록\n"
        "6. 프로그램 커스텀 변수(`meta`)를 타입 캐스팅하여 응답\n\n"
        "### 응답 항상 200\n"
        "유효하지 않은 경우에도 HTTP 200을 반환하며, `valid: false`와 축소된 `error_code`로 이유를 전달합니다. "
        "과도한 요청은 `rate_limited` 오류 코드로 제한될 수 있습니다."
    ),
    response_description="검증 결과 및 라이선스 정보",
)
def validate_license(body: ValidateRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    if _is_validate_rate_limited(client_ip, body.license_key):
        return _rate_limited_response()

    program = crud_program.get_by_name(db, body.program_name)
    if not program:
        return _invalid_validate_response(client_ip, body.license_key, "program_not_found")

    license_ = crud_license.get_by_key(db, body.license_key)
    if not license_:
        return _invalid_validate_response(client_ip, body.license_key, "license_not_found")

    if license_.program_id != program.id:
        return _invalid_validate_response(client_ip, body.license_key, "program_mismatch")

    if not license_.is_active:
        return _invalid_validate_response(client_ip, body.license_key, "license_inactive")

    if license_.expires_at and license_.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return _invalid_validate_response(client_ip, body.license_key, "license_expired")

    device = crud_license.get_device(db, license_.id, body.hwid)
    if device:
        crud_license.touch_device(db, device)
    else:
        count = crud_license.count_devices(db, license_.id)
        if count >= license_.max_devices:
            return _invalid_validate_response(client_ip, body.license_key, "device_limit_reached")
        crud_license.register_device(db, license_.id, body.hwid, body.device_name)

    meta: dict = {}
    for m in license_.meta:
        cast_fn = _CAST.get(m.schema.value_type, str)
        try:
            meta[m.key] = cast_fn(m.value)
        except (ValueError, TypeError):
            meta[m.key] = m.value

    return ValidateResponse(
        valid=True,
        username=license_.username,
        expires_at=license_.expires_at,
        meta=meta if meta else None,
    )
