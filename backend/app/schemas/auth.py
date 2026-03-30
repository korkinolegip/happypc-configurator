from __future__ import annotations
import re
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str  # "Имя Фамилия"
    phone: str
    gender: str  # "male" or "female"
    city: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Введите имя и фамилию")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) == 11 and digits[0] in ("7", "8"):
            digits = "7" + digits[1:]
        elif len(digits) == 10:
            digits = "7" + digits
        if len(digits) != 11 or not digits.startswith("7"):
            raise ValueError("Формат: +7 (999) 999-99-99")
        return f"+7 ({digits[1:4]}) {digits[4:7]} {digits[7:9]} {digits[9:11]}"

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        if v not in ("male", "female"):
            raise ValueError("Выберите пол")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserInToken(BaseModel):
    id: uuid.UUID
    email: str | None
    name: str
    avatar_url: str | None
    role: str
    workshop_id: uuid.UUID | None
    workshop_name: str | None
    gender: str | None = None
    city: str | None = None
    phone: str | None = None
    email_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailVerifyRequest(BaseModel):
    code: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInToken


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class VKAuthCallback(BaseModel):
    code: str
    state: str | None = None
