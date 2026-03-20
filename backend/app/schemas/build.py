import uuid
from datetime import datetime

from pydantic import BaseModel


class BuildItemCreate(BaseModel):
    category: str
    name: str
    url: str | None = None
    price: float = 0.0
    sort_order: int = 0


class BuildItemResponse(BaseModel):
    id: uuid.UUID
    category: str
    name: str
    url: str | None
    price: float
    sort_order: int

    model_config = {"from_attributes": True}


class BuildCreate(BaseModel):
    title: str
    description: str | None = None
    items: list[BuildItemCreate] = []
    is_public: bool = True
    password: str | None = None
    labor_percent: float = 7.0
    labor_price_manual: float | None = None
    tags: list[str] | None = None


class BuildUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    items: list[BuildItemCreate] | None = None
    is_public: bool | None = None
    password: str | None = None
    labor_percent: float | None = None
    labor_price_manual: float | None = None
    tags: list[str] | None = None


class AuthorInfo(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


class WorkshopInfo(BaseModel):
    id: uuid.UUID
    name: str
    city: str

    model_config = {"from_attributes": True}


class BuildResponse(BaseModel):
    id: uuid.UUID
    short_code: str
    title: str
    description: str | None
    author: AuthorInfo
    workshop: WorkshopInfo | None
    is_public: bool
    has_password: bool
    items: list[BuildItemResponse]
    total_price: float
    hardware_total: float
    labor_cost: float
    labor_percent: float
    labor_price_manual: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BuildListItem(BaseModel):
    id: uuid.UUID
    short_code: str
    title: str
    author_name: str
    author_avatar: str | None
    workshop_name: str | None
    total_price: float
    items_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BuildPublicResponse(BaseModel):
    id: uuid.UUID
    short_code: str
    title: str
    description: str | None
    author: AuthorInfo
    workshop: WorkshopInfo | None
    is_public: bool
    has_password: bool
    items: list[BuildItemResponse]
    total_price: float
    hardware_total: float
    labor_cost: float
    labor_percent: float
    labor_price_manual: float | None
    tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
