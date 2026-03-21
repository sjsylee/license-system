from sqlalchemy.orm import Session

from app.models.program import Program, ProgramMetaSchema
from app.schemas.program import ProgramCreate, ProgramMetaSchemaCreate, ProgramUpdate


def get_all(db: Session) -> list[Program]:
    return db.query(Program).order_by(Program.created_at.desc()).all()


def get_by_id(db: Session, program_id: int) -> Program | None:
    return db.get(Program, program_id)


def get_by_name(db: Session, name: str) -> Program | None:
    return db.query(Program).filter(Program.name == name).first()


def create(db: Session, data: ProgramCreate) -> Program:
    program = Program(**data.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def update(db: Session, program: Program, data: ProgramUpdate) -> Program:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(program, field, value)
    db.commit()
    db.refresh(program)
    return program


def delete(db: Session, program: Program) -> None:
    db.delete(program)
    db.commit()


def create_meta_schema(
    db: Session, program_id: int, data: ProgramMetaSchemaCreate
) -> ProgramMetaSchema:
    schema = ProgramMetaSchema(program_id=program_id, **data.model_dump())
    db.add(schema)
    db.commit()
    db.refresh(schema)
    return schema


def get_meta_schemas(db: Session, program_id: int) -> list[ProgramMetaSchema]:
    return db.query(ProgramMetaSchema).filter(ProgramMetaSchema.program_id == program_id).all()


def delete_meta_schema(db: Session, schema: ProgramMetaSchema) -> None:
    db.delete(schema)
    db.commit()
