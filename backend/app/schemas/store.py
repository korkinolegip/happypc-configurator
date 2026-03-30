import uuid
from datetime import datetime

from pydantic import BaseModel


class StoreCreate(BaseModel):
    name: str
    short_label: str
    color: str
    url_patterns: list[str]
    slug: str | None = None


class StoreUpdate(BaseModel):
    name: str | None = None
    short_label: str | None = None
    color: str | None = None
    url_patterns: list[str] | None = None
    slug: str | None = None
    icon_path: str | None = None
    is_auto: bool | None = None
    position: int | None = None


class StoreResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    short_label: str
    color: str
    url_patterns: list[str]
    icon_path: str | None
    icon_url: str | None = None
    is_auto: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StorePublicResponse(BaseModel):
    slug: str
    name: str
    short_label: str
    color: str
    url_patterns: list[str]
    icon_url: str | None = None

    model_config = {"from_attributes": True}
