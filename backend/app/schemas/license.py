from datetime import datetime

from pydantic import BaseModel, Field


class LicenseMetaInput(BaseModel):
    schema_id: int = Field(..., description="프로그램 메타 스키마 ID")
    value: str = Field(..., description="설정값 (문자열로 전달, value_type에 따라 캐스팅됨)", examples=["50"])


class LicenseCreate(BaseModel):
    program_id: int = Field(..., description="라이선스를 발급할 프로그램 ID")
    username: str = Field(..., description="라이선스 소유자 이름", examples=["홍길동"])
    expires_at: datetime | None = Field(default=None, description="만료일 (null이면 무기한)", examples=["2027-12-31T00:00:00"])
    max_devices: int = Field(default=1, ge=1, description="허용 기기 수 (최소 1)")
    meta: list[LicenseMetaInput] = Field(default=[], description="커스텀 변수 값 목록")
    user_id: str | None = Field(default=None, description="사용자 ID (선택)")
    email: str | None = Field(default=None, description="이메일 (선택)")
    phone: str | None = Field(default=None, description="전화번호 (선택)")


class BulkLicenseItem(BaseModel):
    username: str
    license_key: str
    expires_at: datetime | None = None


class BulkImportRequest(BaseModel):
    program_id: int
    max_devices: int = Field(default=5, ge=1)
    licenses: list[BulkLicenseItem]
    meta: list[LicenseMetaInput] = Field(default=[], description="모든 라이선스에 일괄 적용할 메타 값")


class BulkImportItemResult(BaseModel):
    username: str
    license_key: str
    success: bool
    error: str | None = None


class BulkImportResponse(BaseModel):
    total: int
    imported: int
    skipped: int
    results: list[BulkImportItemResult]


class LicenseUpdate(BaseModel):
    expires_at: datetime | None = Field(default=None, description="변경할 만료일")
    max_devices: int | None = Field(default=None, ge=1, description="변경할 허용 기기 수")
    is_active: bool | None = Field(default=None, description="활성화 여부")
    user_id: str | None = Field(default=None, description="사용자 ID")
    email: str | None = Field(default=None, description="이메일")
    phone: str | None = Field(default=None, description="전화번호")


class DeviceResponse(BaseModel):
    id: int
    hwid: str = Field(..., description="기기 고유 식별자")
    device_name: str | None = Field(description="기기 이름")
    activated_at: datetime = Field(..., description="최초 활성화 일시")
    last_seen_at: datetime = Field(..., description="마지막 검증 일시")

    model_config = {"from_attributes": True}


class LicenseMetaResponse(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


class LicenseResponse(BaseModel):
    id: int
    program_id: int
    username: str
    license_key: str = Field(..., description="발급된 라이선스 키")
    expires_at: datetime | None = Field(description="만료일 (null이면 무기한)")
    max_devices: int = Field(..., description="허용 기기 수")
    is_active: bool = Field(..., description="활성화 여부")
    created_at: datetime
    user_id: str | None = None
    email: str | None = None
    phone: str | None = None
    meta: list[LicenseMetaResponse] = []
    devices: list[DeviceResponse] = []

    model_config = {"from_attributes": True}
