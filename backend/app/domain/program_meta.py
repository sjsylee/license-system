from collections.abc import Iterable
from typing import Any

from sqlalchemy.orm import Session

from app.models.license import License, LicenseMeta
from app.models.program import ProgramMetaSchema


def _cast_bool(value: str) -> bool:
    return value.lower() in ("true", "1", "yes")


_CASTERS = {
    "int": int,
    "float": float,
    "bool": _cast_bool,
    "str": str,
}


def cast_value(value: str, value_type: str) -> Any:
    caster = _CASTERS.get(value_type, str)
    return caster(value)


def validate_value(value: str, schema: ProgramMetaSchema) -> None:
    try:
        cast_value(value, schema.value_type)
    except (ValueError, TypeError):
        raise ValueError(
            f"'{value}'을 {schema.value_type}로 변환할 수 없습니다. (key: {schema.key})"
        )


def validate_backfill_value(value: str | None, value_type: str) -> None:
    if not value:
        return
    try:
        cast_value(value, value_type)
    except (ValueError, TypeError):
        raise ValueError(f"backfill_value '{value}'을 {value_type}로 변환할 수 없습니다.")


def get_schemas_by_id(db: Session, schema_ids: Iterable[int]) -> dict[int, ProgramMetaSchema | None]:
    return {schema_id: db.get(ProgramMetaSchema, schema_id) for schema_id in set(schema_ids)}


def add_meta_values(
    db: Session,
    license_id: int,
    meta_inputs: Iterable[Any],
    schemas_by_id: dict[int, ProgramMetaSchema | None] | None = None,
) -> None:
    for meta_in in meta_inputs:
        schema = (
            schemas_by_id.get(meta_in.schema_id)
            if schemas_by_id is not None
            else db.get(ProgramMetaSchema, meta_in.schema_id)
        )
        if schema:
            db.add(
                LicenseMeta(
                    license_id=license_id,
                    schema_id=schema.id,
                    key=schema.key,
                    value=meta_in.value,
                )
            )


def backfill_schema_value(
    db: Session,
    program_id: int,
    schema: ProgramMetaSchema,
    value: str | None,
) -> None:
    if value is None:
        return

    licenses = db.query(License).filter(License.program_id == program_id).all()
    for license_ in licenses:
        db.add(
            LicenseMeta(
                license_id=license_.id,
                schema_id=schema.id,
                key=schema.key,
                value=value,
            )
        )


def set_meta_value(
    db: Session,
    license_id: int,
    schema: ProgramMetaSchema,
    value: str,
    key: str | None = None,
) -> LicenseMeta:
    existing = (
        db.query(LicenseMeta)
        .filter(LicenseMeta.license_id == license_id, LicenseMeta.schema_id == schema.id)
        .first()
    )
    if existing:
        existing.value = value
        return existing

    meta = LicenseMeta(license_id=license_id, schema_id=schema.id, key=key or schema.key, value=value)
    db.add(meta)
    db.flush()
    return meta


def project_meta_values(meta_values: Iterable[LicenseMeta]) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    for value in meta_values:
        try:
            meta[value.key] = cast_value(value.value, value.schema.value_type)
        except (ValueError, TypeError):
            meta[value.key] = value.value
    return meta
