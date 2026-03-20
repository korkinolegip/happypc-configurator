import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
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
    telegram_username: str | None = None
    vk_url: str | None = None
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublicProfile(BaseModel):
    """Public profile — phone hidden from regular users."""
    id: uuid.UUID
    name: str
    avatar_url: str | None
    role: str
    city: str | None = None
    workshop_name: str | None = None
    telegram_username: str | None = None
    vk_url: str | None = None
    builds_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None
    city: str | None = None
    phone: str | None = None
    gender: str | None = None


class ChangePassword(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


class UserAdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "user"
    workshop_id: uuid.UUID | None = None
    city: str | None = None
    phone: str | None = None
    gender: str | None = None


class UserAdminUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    workshop_id: uuid.UUID | None = None
    is_active: bool | None = None
    password: str | None = None
    city: str | None = None
    phone: str | None = None
    gender: str | None = None
    avatar_url: str | None = None
