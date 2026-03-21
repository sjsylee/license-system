from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., examples=["admin"])
    password: str = Field(..., examples=["password123"])


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT Access Token (유효기간: 30분)")
    token_type: str = Field(default="bearer")
