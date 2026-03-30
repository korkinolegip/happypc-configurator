import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.build import BuildListItem


class WorkshopCreate(BaseModel):
    name: str
    city: str


class WorkshopResponse(BaseModel):
    id: uuid.UUID
    name: str
    city: str
    masters_count: int = 0
    builds_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingsResponse(BaseModel):
    settings: dict[str, str]


class MasterActivity(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None
    role: str
    workshop_name: str | None
    builds_count: int
    last_activity: datetime | None

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    users_count: int
    builds_count: int
    workshops_count: int
    bugs_count: int = 0
    recent_builds: list[BuildListItem]
    masters_activity: list[MasterActivity] = []
