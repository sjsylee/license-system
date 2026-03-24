from datetime import datetime

from pydantic import BaseModel, Field


class ValidateRequest(BaseModel):
    license_key: str = Field(..., description="발급된 라이선스 키", examples=["ABCD1234-EFGH5678-IJKL9012-MNOP3456"])
    hwid: str = Field(..., description="기기 고유 식별자 (하드웨어 핑거프린트)", examples=["HWID-ABC123-XYZ789"])
    program_name: str = Field(..., description="검증할 프로그램 이름", examples=["program-a"])
    device_name: str | None = Field(default=None, description="기기 이름 (선택, 어드민 화면에 표시용)", examples=["MacBook Pro"])


class ValidateResponse(BaseModel):
    valid: bool = Field(..., description="라이선스 유효 여부")
    error_code: str | None = Field(
        default=None,
        description=(
            "유효하지 않을 때의 오류 코드. 가능한 값:\n"
            "- `invalid_license`: 프로그램명/라이선스 키 조합이 유효하지 않음\n"
            "- `license_unusable`: 라이선스를 현재 사용할 수 없음\n"
            "- `device_limit_reached`: 허용 기기 수 초과\n"
            "- `rate_limited`: 과도한 검증 요청으로 잠시 제한됨"
        ),
    )
    username: str | None = Field(default=None, description="라이선스 소유자 이름")
    expires_at: datetime | None = Field(default=None, description="라이선스 만료일 (null이면 무기한)")
    meta: dict | None = Field(
        default=None,
        description="프로그램별 커스텀 변수. value_type에 따라 실제 타입으로 캐스팅됩니다.",
        examples=[{"max_collection_count": 100, "feature_x_enabled": True}],
    )
