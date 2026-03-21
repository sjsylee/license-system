from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine
from app.models import Admin, Device, License, LicenseMeta, Program, ProgramMetaSchema, RefreshToken  # noqa: F401
from app.routers import auth, licenses, programs, validate

Base.metadata.create_all(bind=engine)

Path("uploads/programs").mkdir(parents=True, exist_ok=True)

openapi_tags = [
    {
        "name": "인증",
        "description": (
            "어드민 로그인 및 토큰 관리. "
            "**Dual Token** 방식(Access Token + Refresh Token)을 사용하며, "
            "Refresh Token은 `httpOnly` 쿠키로 관리됩니다. "
            "보안을 위해 Refresh 시마다 토큰을 교체하는 **Rotation** 전략을 적용합니다."
        ),
    },
    {
        "name": "프로그램 관리",
        "description": (
            "라이선스를 발급할 프로그램(소프트웨어)을 등록하고 관리합니다. "
            "프로그램별로 **확장 변수 스키마**를 정의하여 라이선스마다 커스텀 제한값을 설정할 수 있습니다. "
            "예: `max_collection_count`, `feature_x_enabled` 등. "
            "모든 엔드포인트는 어드민 Bearer 토큰 인증이 필요합니다."
        ),
    },
    {
        "name": "라이선스 관리",
        "description": (
            "사용자에게 라이선스 키를 발급하고 관리합니다. "
            "라이선스에는 만료일, 허용 PC 대수(`max_devices`), 확장 변수값을 지정할 수 있습니다. "
            "활성화된 기기(PC) 목록 조회 및 특정 기기의 등록 해제도 지원합니다. "
            "모든 엔드포인트는 어드민 Bearer 토큰 인증이 필요합니다."
        ),
    },
    {
        "name": "라이선스 검증",
        "description": (
            "Electron 데스크톱 앱이 **시작 시 호출**하는 공개 엔드포인트입니다. "
            "라이선스 키와 기기 식별자(HWID)를 전달하면 유효성을 검증하고, "
            "신규 기기는 자동으로 등록합니다. "
            "응답에 프로그램별 커스텀 메타 변수가 포함됩니다."
        ),
    },
]

app = FastAPI(
    title="License System API",
    description=(
        "Electron 데스크톱 앱을 위한 **라이선스 발급 및 검증 시스템**입니다.\n\n"
        "## 주요 기능\n"
        "- 여러 프로그램의 라이선스를 통합 관리\n"
        "- 사용자별 허용 PC 대수 제한 (기기 핑거프린트 기반)\n"
        "- 프로그램별 확장 변수 스키마로 유연한 커스텀 제한값 설정\n"
        "- Dual Token 인증 (Access Token + Refresh Token Rotation)\n\n"
        "## 인증 방법\n"
        "`POST /auth/login`으로 로그인 후 발급받은 `access_token`을 "
        "`Authorization: Bearer <token>` 헤더에 포함하세요."
    ),
    version="1.0.0",
    openapi_tags=openapi_tags,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(programs.router)
app.include_router(licenses.router)
app.include_router(validate.router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}
