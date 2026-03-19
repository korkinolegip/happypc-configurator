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
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class UserAdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "user"
    workshop_id: uuid.UUID | None = None


class UserAdminUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    workshop_id: uuid.UUID | None = None
    is_active: bool | None = None
    password: str | None = None
