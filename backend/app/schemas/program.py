from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MetaValueType = Literal["int", "str", "bool", "float"]


class ProgramMetaSchemaCreate(BaseModel):
    key: str = Field(..., description="변수 키 이름", examples=["max_collection_count"])
    value_type: MetaValueType = Field(..., description="값의 타입 (int | str | bool | float)")
    description: str | None = Field(default=None, description="변수 설명", examples=["최대 수집 가능 개수"])
    default_value: str | None = Field(default=None, description="기본값 (문자열로 저장)", examples=["100"])


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
