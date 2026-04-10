from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import generate_license_key
from app.models.license import Device, License, LicenseMeta
from app.schemas.license import LicenseCreate, LicenseUpdate


def get_by_id(db: Session, license_id: int) -> License | None:
    return db.get(License, license_id)


def get_by_key(db: Session, license_key: str) -> License | None:
    return db.query(License).filter(License.license_key == license_key).first()


def get_by_program(db: Session, program_id: int) -> list[License]:
    return (
        db.query(License)
        .filter(License.program_id == program_id)
        .order_by(License.created_at.desc())
        .all()
    )


def create(db: Session, data: LicenseCreate) -> License:
    license_key = generate_license_key()
    license_ = License(
        program_id=data.program_id,
        username=data.username,
        license_key=license_key,
        expires_at=data.expires_at,
        max_devices=data.max_devices,
        user_id=data.user_id,
        email=data.email,
        phone=data.phone,
    )
    db.add(license_)
    db.flush()

    for meta_in in data.meta:
        from app.models.program import ProgramMetaSchema

        schema = db.get(ProgramMetaSchema, meta_in.schema_id)
        if schema:
            db.add(
                LicenseMeta(
                    license_id=license_.id,
                    schema_id=schema.id,
                    key=schema.key,
                    value=meta_in.value,
                )
            )

    db.commit()
    db.refresh(license_)
    return license_


def bulk_import(db: Session, program_id: int, max_devices: int, items: list, meta_inputs: list) -> dict:
    from app.models.program import ProgramMetaSchema
    from app.schemas.license import BulkImportItemResult

    # 메타 스키마 미리 조회
    meta_schemas = {m.schema_id: db.get(ProgramMetaSchema, m.schema_id) for m in meta_inputs}

    results = []
    imported = 0
    skipped = 0

    for item in items:
        existing = get_by_key(db, item.license_key)
        if existing:
            results.append(BulkImportItemResult(
                username=item.username,
                license_key=item.license_key,
                success=False,
                error="이미 존재하는 라이선스 키입니다.",
            ))
            skipped += 1
            continue
        try:
            is_active = True
            if item.expires_at and item.expires_at < datetime.now(timezone.utc):
                is_active = False
            license_ = License(
                program_id=program_id,
                username=item.username,
                license_key=item.license_key,
                expires_at=item.expires_at,
                max_devices=max_devices,
                is_active=is_active,
            )
            db.add(license_)
            db.flush()

            for meta_in in meta_inputs:
                schema = meta_schemas.get(meta_in.schema_id)
                if schema:
                    db.add(LicenseMeta(
                        license_id=license_.id,
                        schema_id=schema.id,
                        key=schema.key,
                        value=meta_in.value,
                    ))

            results.append(BulkImportItemResult(
                username=item.username,
                license_key=item.license_key,
                success=True,
            ))
            imported += 1
        except IntegrityError:
            db.rollback()
            results.append(BulkImportItemResult(
                username=item.username,
                license_key=item.license_key,
                success=False,
                error="데이터 제약 조건을 만족하지 않아 가져오지 못했습니다.",
            ))
            skipped += 1
        except (ValueError, TypeError):
            db.rollback()
            results.append(BulkImportItemResult(
                username=item.username,
                license_key=item.license_key,
                success=False,
                error="입력값 형식이 올바르지 않아 가져오지 못했습니다.",
            ))
            skipped += 1
        except SQLAlchemyError:
            db.rollback()
            results.append(BulkImportItemResult(
                username=item.username,
                license_key=item.license_key,
                success=False,
                error="데이터 저장 중 오류가 발생했습니다.",
            ))
            skipped += 1
        except Exception:
            db.rollback()
            results.append(BulkImportItemResult(
                username=item.username,
                license_key=item.license_key,
                success=False,
                error="가져오기 중 예상하지 못한 오류가 발생했습니다.",
            ))
            skipped += 1

    db.commit()
    return {"total": len(items), "imported": imported, "skipped": skipped, "results": results}


def update(db: Session, license_: License, data: LicenseUpdate) -> License:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(license_, field, value)
    db.commit()
    db.refresh(license_)
    return license_


def delete(db: Session, license_: License) -> None:
    db.delete(license_)
    db.commit()


# --- Device operations ---

def get_device(db: Session, license_id: int, hwid: str) -> Device | None:
    return (
        db.query(Device)
        .filter(Device.license_id == license_id, Device.hwid == hwid)
        .first()
    )


def count_devices(db: Session, license_id: int) -> int:
    return db.query(Device).filter(Device.license_id == license_id).count()


def register_device(db: Session, license_id: int, hwid: str, device_name: str | None) -> Device:
    device = Device(license_id=license_id, hwid=hwid, device_name=device_name)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def touch_device(db: Session, device: Device) -> Device:
    device.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return device


def remove_device(db: Session, device: Device) -> None:
    db.delete(device)
    db.commit()


_CAST_FN: dict = {
    "int": int,
    "float": float,
    "bool": lambda v: v.lower() in ("true", "1", "yes"),
    "str": str,
}


# --- Meta operations ---

def set_meta(db: Session, license_id: int, schema_id: int, key: str, value: str) -> LicenseMeta:
    existing = (
        db.query(LicenseMeta)
        .filter(LicenseMeta.license_id == license_id, LicenseMeta.schema_id == schema_id)
        .first()
    )
    if existing:
        existing.value = value
        db.commit()
        return existing
    meta = LicenseMeta(license_id=license_id, schema_id=schema_id, key=key, value=value)
    db.add(meta)
    db.commit()
    db.refresh(meta)
    return meta


def bulk_update_meta(db: Session, license_: License, updates: list) -> None:
    """라이선스 메타 값을 일괄 업데이트합니다. ValueError 발생 시 롤백하지 않고 호출자에게 위임."""
    from app.models.program import ProgramMetaSchema

    for item in updates:
        schema = db.get(ProgramMetaSchema, item.schema_id)
        if not schema:
            raise ValueError(f"Schema {item.schema_id}를 찾을 수 없습니다.")
        if schema.program_id != license_.program_id:
            raise ValueError(f"Schema {item.schema_id}는 이 라이선스 프로그램에 속하지 않습니다.")
        cast_fn = _CAST_FN.get(schema.value_type, str)
        try:
            cast_fn(item.value)
        except (ValueError, TypeError):
            raise ValueError(
                f"'{item.value}'을 {schema.value_type}로 변환할 수 없습니다. (key: {schema.key})"
            )
        set_meta(db, license_.id, schema.id, schema.key, item.value)
