from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


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
    created_at: datetime

    model_config = {"from_attributes": True}


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
