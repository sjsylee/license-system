from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import license as crud_license
from app.crud import program as crud_program
from app.dependencies import get_current_admin, get_db
from app.models.admin import Admin
from app.schemas.license import BulkImportRequest, BulkImportResponse, LicenseCreate, LicenseResponse, LicenseUpdate

router = APIRouter(prefix="/admin/licenses", tags=["라이선스 관리"])


@router.get(
    "",
    response_model=list[LicenseResponse],
    summary="라이선스 목록 조회",
    description="특정 프로그램의 라이선스 목록을 조회합니다. `?program_id=1` 쿼리 파라미터 필수.",
    response_description="라이선스 목록 (생성일 내림차순)",
)
def list_licenses(
    program_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    if not crud_program.get_by_id(db, program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return crud_license.get_by_program(db, program_id)


@router.post(
    "",
    response_model=LicenseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="라이선스 발급",
    description=(
        "사용자에게 라이선스를 발급합니다.\n\n"
        "- 라이선스 키는 `XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX` 형식으로 자동 생성됩니다.\n"
        "- `meta` 필드에 프로그램 확장 변수 스키마 ID와 값을 전달하면 라이선스별 제한값을 설정할 수 있습니다.\n"
        "- `expires_at`을 `null`로 설정하면 무기한 라이선스가 발급됩니다."
    ),
    response_description="발급된 라이선스 정보 (라이선스 키 포함)",
)
def create_license(
    body: LicenseCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    if not crud_program.get_by_id(db, body.program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return crud_license.create(db, body)


@router.post(
    "/bulk-import",
    response_model=BulkImportResponse,
    summary="라이선스 일괄 가져오기",
    description=(
        "기존 라이선스 키를 그대로 유지하며 일괄 등록합니다.\n\n"
        "이미 존재하는 키는 건너뛰고 나머지만 등록합니다."
    ),
)
def bulk_import_licenses(
    body: BulkImportRequest,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    if not crud_program.get_by_id(db, body.program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    result = crud_license.bulk_import(db, body.program_id, body.max_devices, body.licenses, body.meta)
    return result


@router.get(
    "/{license_id}",
    response_model=LicenseResponse,
    summary="라이선스 상세 조회",
    response_description="라이선스 정보, 메타 변수, 활성화된 기기 목록",
)
def get_license(
    license_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    license_ = crud_license.get_by_id(db, license_id)
    if not license_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    return license_


@router.patch(
    "/{license_id}",
    response_model=LicenseResponse,
    summary="라이선스 수정",
    description="만료일, 허용 기기 수, 활성화 여부를 수정합니다. 전달한 필드만 업데이트됩니다.",
    response_description="수정된 라이선스 정보",
)
def update_license(
    license_id: int,
    body: LicenseUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    license_ = crud_license.get_by_id(db, license_id)
    if not license_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    # 만료된 라이선스는 만료일 연장 없이 활성화 불가
    if body.is_active is True and body.expires_at is None:
        if license_.expires_at and license_.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="만료된 라이선스는 만료일을 연장한 후 활성화할 수 있습니다.",
            )
    return crud_license.update(db, license_, body)


@router.delete(
    "/{license_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="라이선스 삭제",
    description="라이선스를 삭제합니다. 연결된 기기 등록 정보와 메타 데이터도 함께 삭제됩니다.",
)
def delete_license(
    license_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    license_ = crud_license.get_by_id(db, license_id)
    if not license_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    crud_license.delete(db, license_)


@router.delete(
    "/{license_id}/devices/{hwid}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="기기 등록 해제",
    description=(
        "특정 기기의 라이선스 등록을 해제합니다.\n\n"
        "사용자가 PC를 교체하거나 분실했을 때 어드민이 슬롯을 반환해주는 용도로 사용합니다."
    ),
)
def remove_device(
    license_id: int,
    hwid: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    device = crud_license.get_device(db, license_id, hwid)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    crud_license.remove_device(db, device)
