from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.crud import license as crud_license
from app.crud import program as crud_program
from app.domain.device_activation import activate_device
from app.domain.program_meta import project_meta_values


@dataclass(frozen=True)
class LicenseValidationResult:
    valid: bool
    error_code: str | None = None
    username: str | None = None
    expires_at: datetime | None = None
    meta: dict[str, Any] | None = None


def public_validate_error_code(error_code: str) -> str:
    if error_code in {"program_not_found", "license_not_found", "program_mismatch"}:
        return "invalid_license"
    if error_code in {"license_inactive", "license_expired"}:
        return "license_unusable"
    return error_code


def validate_license(
    db: Session,
    program_name: str,
    license_key: str,
    hwid: str,
    device_name: str | None,
) -> LicenseValidationResult:
    program = crud_program.get_by_name(db, program_name)
    if not program:
        return LicenseValidationResult(valid=False, error_code="program_not_found")

    license_ = crud_license.get_by_key(db, license_key)
    if not license_:
        return LicenseValidationResult(valid=False, error_code="license_not_found")

    if license_.program_id != program.id:
        return LicenseValidationResult(valid=False, error_code="program_mismatch")

    if not license_.is_active:
        return LicenseValidationResult(valid=False, error_code="license_inactive")

    if (
        license_.expires_at
        and license_.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    ):
        return LicenseValidationResult(valid=False, error_code="license_expired")

    device_activation = activate_device(db, license_, hwid, device_name)
    if not device_activation.is_allowed:
        return LicenseValidationResult(valid=False, error_code=device_activation.error_code)

    meta = project_meta_values(license_.meta)
    return LicenseValidationResult(
        valid=True,
        username=license_.username,
        expires_at=license_.expires_at,
        meta=meta if meta else None,
    )
