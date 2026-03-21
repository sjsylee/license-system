import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.crud import program as crud_program
from app.dependencies import get_current_admin, get_db
from app.models.admin import Admin
from app.schemas.program import (
    ProgramCreate,
    ProgramMetaSchemaCreate,
    ProgramMetaSchemaResponse,
    ProgramResponse,
    ProgramUpdate,
)

UPLOAD_DIR = Path("uploads/programs")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

router = APIRouter(prefix="/admin/programs", tags=["프로그램 관리"])


@router.get(
    "",
    response_model=list[ProgramResponse],
    summary="프로그램 목록 조회",
    response_description="등록된 프로그램 목록 (생성일 내림차순)",
)
def list_programs(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    return crud_program.get_all(db)


@router.post(
    "",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
    summary="프로그램 등록",
    description="새 프로그램을 등록합니다. `name`은 시스템 전체에서 고유해야 합니다.",
    response_description="생성된 프로그램 정보",
)
def create_program(
    body: ProgramCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    if crud_program.get_by_name(db, body.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Program name already exists")
    return crud_program.create(db, body)


@router.get(
    "/{program_id}",
    response_model=ProgramResponse,
    summary="프로그램 상세 조회",
    response_description="프로그램 정보 및 확장 변수 스키마 목록",
)
def get_program(
    program_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    program = crud_program.get_by_id(db, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return program


@router.patch(
    "/{program_id}",
    response_model=ProgramResponse,
    summary="프로그램 수정",
    description="프로그램 설명을 수정합니다.",
    response_description="수정된 프로그램 정보",
)
def update_program(
    program_id: int,
    body: ProgramUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    program = crud_program.get_by_id(db, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return crud_program.update(db, program, body)


@router.delete(
    "/{program_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="프로그램 삭제",
    description="프로그램을 삭제합니다. 해당 프로그램의 **모든 라이선스와 기기 정보도 함께 삭제**됩니다.",
)
def delete_program(
    program_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    program = crud_program.get_by_id(db, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    crud_program.delete(db, program)


# --- Image upload ---

@router.post(
    "/{program_id}/upload-image",
    response_model=ProgramResponse,
    summary="프로그램 대표 이미지 업로드",
    description="프로그램 대표 이미지를 업로드합니다. 지원 형식: JPG, PNG, GIF, WebP",
)
async def upload_program_image(
    program_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    program = crud_program.get_by_id(db, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 이미지 형식입니다.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # 기존 이미지 삭제
    if program.image_url:
        old_path = Path(program.image_url.lstrip("/"))
        if old_path.exists():
            old_path.unlink()

    filename = f"{program_id}_{uuid.uuid4().hex}{ext}"
    save_path = UPLOAD_DIR / filename
    save_path.write_bytes(await file.read())

    return crud_program.update(db, program, ProgramUpdate(image_url=f"/uploads/programs/{filename}"))


# --- Meta schema endpoints ---

@router.get(
    "/{program_id}/meta-schemas",
    response_model=list[ProgramMetaSchemaResponse],
    summary="확장 변수 스키마 목록 조회",
    description="해당 프로그램에 정의된 커스텀 변수 스키마 목록을 반환합니다.",
)
def list_meta_schemas(
    program_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    if not crud_program.get_by_id(db, program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return crud_program.get_meta_schemas(db, program_id)


@router.post(
    "/{program_id}/meta-schemas",
    response_model=ProgramMetaSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="확장 변수 스키마 추가",
    description=(
        "프로그램에 커스텀 변수 스키마를 추가합니다.\n\n"
        "라이선스 발급 시 이 스키마를 참조해 사용자별 값을 설정할 수 있습니다.\n"
        "예: `max_collection_count` (int), `feature_x_enabled` (bool)"
    ),
    response_description="생성된 스키마 정보",
)
def create_meta_schema(
    program_id: int,
    body: ProgramMetaSchemaCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    if not crud_program.get_by_id(db, program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return crud_program.create_meta_schema(db, program_id, body)


@router.delete(
    "/meta-schemas/{schema_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="확장 변수 스키마 삭제",
    description="스키마를 삭제합니다. 해당 스키마를 참조하는 라이선스 메타 데이터도 함께 삭제됩니다.",
)
def delete_meta_schema(
    schema_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    from app.models.program import ProgramMetaSchema

    schema = db.get(ProgramMetaSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema not found")
    crud_program.delete_meta_schema(db, schema)
