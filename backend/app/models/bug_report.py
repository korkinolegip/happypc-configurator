import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BugReport(Base):
    __tablename__ = "bug_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    screenshot_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    page_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reporter_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Status: new, in_progress, done, needs_rework
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    comments: Mapped[list["BugComment"]] = relationship(
        "BugComment", back_populates="bug", cascade="all, delete-orphan",
        order_by="BugComment.created_at",
    )


class BugComment(Base):
    __tablename__ = "bug_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bug_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bug_reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    screenshots: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    # If comment changed status
    new_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    bug: Mapped["BugReport"] = relationship("BugReport", back_populates="comments")
