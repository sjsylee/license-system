from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import license as crud_license
from app.crud import program as crud_program
from app.dependencies import get_db
from app.schemas.validate import ValidateRequest, ValidateResponse

router = APIRouter(prefix="/v1", tags=["라이선스 검증"])

_CAST = {
    "int": int,
    "float": float,
    "bool": lambda v: v.lower() in ("true", "1", "yes"),
    "str": str,
}


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
        "유효하지 않은 경우에도 HTTP 200을 반환하며, `valid: false`와 `error_code`로 이유를 전달합니다."
    ),
    response_description="검증 결과 및 라이선스 정보",
)
def validate_license(body: ValidateRequest, db: Session = Depends(get_db)):
    program = crud_program.get_by_name(db, body.program_name)
    if not program:
        return ValidateResponse(valid=False, error_code="program_not_found")

    license_ = crud_license.get_by_key(db, body.license_key)
    if not license_:
        return ValidateResponse(valid=False, error_code="license_not_found")

    if license_.program_id != program.id:
        return ValidateResponse(valid=False, error_code="program_mismatch")

    if not license_.is_active:
        return ValidateResponse(valid=False, error_code="license_inactive")

    if license_.expires_at and license_.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return ValidateResponse(valid=False, error_code="license_expired")

    device = crud_license.get_device(db, license_.id, body.hwid)
    if device:
        crud_license.touch_device(db, device)
    else:
        count = crud_license.count_devices(db, license_.id)
        if count >= license_.max_devices:
            return ValidateResponse(valid=False, error_code="device_limit_reached")
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
