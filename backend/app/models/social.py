import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BuildView(Base):
    """Track unique views per build per user/session."""
    __tablename__ = "build_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    build_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builds.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BuildLike(Base):
    """One like per user per build."""
    __tablename__ = "build_likes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    build_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builds.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BuildComment(Base):
    """Comments with optional reply (parent_id)."""
    __tablename__ = "build_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    build_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builds.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("build_comments.id", ondelete="CASCADE"), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="joined")
    replies: Mapped[list["BuildComment"]] = relationship(
        "BuildComment", back_populates="parent", cascade="all, delete-orphan",
        lazy="selectin",
    )
    parent: Mapped["BuildComment | None"] = relationship(
        "BuildComment", back_populates="replies", remote_side=[id],
    )


class Tag(Base):
    """Tags with usage count for popularity."""
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
