from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.crud import license as crud_license
from app.models.license import License


@dataclass(frozen=True)
class DeviceActivationResult:
    error_code: str | None = None

    @property
    def is_allowed(self) -> bool:
        return self.error_code is None


def activate_device(
    db: Session,
    license_: License,
    hwid: str,
    device_name: str | None,
) -> DeviceActivationResult:
    device = crud_license.get_device(db, license_.id, hwid)
    if device:
        crud_license.touch_device(db, device)
        return DeviceActivationResult()

    count = crud_license.count_devices(db, license_.id)
    if count >= license_.max_devices:
        return DeviceActivationResult(error_code="device_limit_reached")

    crud_license.register_device(db, license_.id, hwid, device_name)
    return DeviceActivationResult()
