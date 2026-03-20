import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Button 1
    button_text: Mapped[str | None] = mapped_column(String(128), nullable=True)
    button_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    button_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Button 2
    button2_text: Mapped[str | None] = mapped_column(String(128), nullable=True)
    button2_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    button2_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
