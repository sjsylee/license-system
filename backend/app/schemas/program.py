from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

MetaValueType = Literal["int", "str", "bool", "float"]

_CAST_FN: dict = {
    "int": int,
    "float": float,
    "bool": lambda v: v.lower() in ("true", "1", "yes"),
    "str": str,
}


class ProgramMetaSchemaCreate(BaseModel):
    key: str = Field(..., description="변수 키 이름", examples=["max_collection_count"])
    value_type: MetaValueType = Field(..., description="값의 타입 (int | str | bool | float)")
    description: str | None = Field(default=None, description="변수 설명", examples=["최대 수집 가능 개수"])
    default_value: str | None = Field(default=None, description="기본값 (문자열로 저장)", examples=["100"])
    backfill_value: str | None = Field(
        default=None,
        description=(
            "기존 라이선스에 소급 적용할 값. "
            "null이면 기존 라이선스에 적용하지 않습니다. "
            "빈 문자열이라도 전달하면 해당 값으로 소급 적용합니다."
        ),
    )

    @model_validator(mode="after")
    def validate_backfill_castable(self) -> "ProgramMetaSchemaCreate":
        if self.backfill_value:  # non-empty string only
            try:
                _CAST_FN[self.value_type](self.backfill_value)
            except (ValueError, TypeError):
                raise ValueError(
                    f"backfill_value '{self.backfill_value}'을 {self.value_type}로 변환할 수 없습니다."
                )
        return self


class ProgramMetaSchemaResponse(BaseModel):
    id: int
    key: str
    value_type: MetaValueType
    description: str | None
    default_value: str | None

    model_config = {"from_attributes": True}


class ProgramCreate(BaseModel):
    name: str = Field(..., description="프로그램 고유 이름 (중복 불가)", examples=["program-a"])
    description: str | None = Field(default=None, description="프로그램 설명", examples=["수집 자동화 프로그램"])


class ProgramUpdate(BaseModel):
    description: str | None = Field(default=None, description="변경할 설명")
    image_url: str | None = Field(default=None, description="대표 이미지 경로")


class ProgramResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_url: str | None
    created_at: datetime
    meta_schemas: list[ProgramMetaSchemaResponse] = []

    model_config = {"from_attributes": True}
