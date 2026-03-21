from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.license import License


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    meta_schemas: Mapped[list["ProgramMetaSchema"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )
    licenses: Mapped[list["License"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )


class ProgramMetaSchema(Base):
    __tablename__ = "program_meta_schemas"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False)  # int | str | bool | float
    description: Mapped[str | None] = mapped_column(Text)
    default_value: Mapped[str | None] = mapped_column(String(500))

    __table_args__ = (UniqueConstraint("program_id", "key", name="uq_program_meta_key"),)

    program: Mapped["Program"] = relationship(back_populates="meta_schemas")
