from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.program import Program, ProgramMetaSchema


class License(Base):
    __tablename__ = "licenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"))
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    license_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    max_devices: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    program: Mapped["Program"] = relationship(back_populates="licenses")
    meta: Mapped[list["LicenseMeta"]] = relationship(
        back_populates="license", cascade="all, delete-orphan"
    )
    devices: Mapped[list["Device"]] = relationship(
        back_populates="license", cascade="all, delete-orphan"
    )


class LicenseMeta(Base):
    __tablename__ = "license_meta"

    id: Mapped[int] = mapped_column(primary_key=True)
    license_id: Mapped[int] = mapped_column(ForeignKey("licenses.id", ondelete="CASCADE"))
    schema_id: Mapped[int] = mapped_column(
        ForeignKey("program_meta_schemas.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)  # denormalized for query speed
    value: Mapped[str] = mapped_column(String(500), nullable=False)

    license: Mapped["License"] = relationship(back_populates="meta")
    schema: Mapped["ProgramMetaSchema"] = relationship()


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    license_id: Mapped[int] = mapped_column(ForeignKey("licenses.id", ondelete="CASCADE"))
    hwid: Mapped[str] = mapped_column(String(256), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(200))
    activated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    last_seen_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("license_id", "hwid", name="uq_license_hwid"),)

    license: Mapped["License"] = relationship(back_populates="devices")
