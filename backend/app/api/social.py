import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.build import Build
from app.models.social import BuildComment, BuildLike, BuildView, Tag
from app.models.user import User

router = APIRouter()


# ── Views ────────────────────────────────────────────────────────────────────

@router.post("/{build_id}/view")
async def record_view(
    build_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Record a view. Deduplicates by user or IP hash within 24h."""
    # Get user if authenticated
    user_id = None
    try:
        from app.dependencies import get_current_user
        user = await get_current_user(
            await request.headers.get("authorization", "").replace("Bearer ", ""),
            db,
        )
        user_id = user.id if user else None
    except Exception:
        pass

    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]

    # Check for recent view (24h)
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(hours=24)
    existing = await db.execute(
        select(BuildView).where(
            BuildView.build_id == build_id,
            BuildView.created_at > cutoff,
            (BuildView.user_id == user_id) if user_id else (BuildView.ip_hash == ip_hash),
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_viewed"}

    view = BuildView(build_id=build_id, user_id=user_id, ip_hash=ip_hash)
    db.add(view)
    return {"status": "viewed"}


@router.get("/{build_id}/stats")
async def get_build_stats(
    build_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get likes, views, comments count for a build."""
    views = (await db.execute(
        select(func.count()).where(BuildView.build_id == build_id)
    )).scalar() or 0

    likes = (await db.execute(
        select(func.count()).where(BuildLike.build_id == build_id)
    )).scalar() or 0

    comments = (await db.execute(
        select(func.count()).where(
            BuildComment.build_id == build_id,
            BuildComment.is_hidden == False,  # noqa
        )
    )).scalar() or 0

    return {"views": views, "likes": likes, "comments": comments}


# ── Likes ────────────────────────────────────────────────────────────────────

@router.post("/{build_id}/like")
async def toggle_like(
    build_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle like. Returns new like status and count."""
    existing = await db.execute(
        select(BuildLike).where(
            BuildLike.build_id == build_id,
            BuildLike.user_id == current_user.id,
        )
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        liked = False
    else:
        db.add(BuildLike(build_id=build_id, user_id=current_user.id))
        liked = True

    await db.flush()
    count = (await db.execute(
        select(func.count()).where(BuildLike.build_id == build_id)
    )).scalar() or 0

    return {"liked": liked, "count": count}


@router.get("/{build_id}/liked")
async def check_liked(
    build_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(BuildLike).where(
            BuildLike.build_id == build_id,
            BuildLike.user_id == current_user.id,
        )
    )
    return {"liked": existing.scalar_one_or_none() is not None}


# ── Comments ─────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    text: str
    parent_id: uuid.UUID | None = None


@router.get("/{build_id}/comments")
async def get_comments(
    build_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get top-level comments with replies."""
    result = await db.execute(
        select(BuildComment)
        .where(
            BuildComment.build_id == build_id,
            BuildComment.parent_id == None,  # noqa
            BuildComment.is_hidden == False,  # noqa
        )
        .options(selectinload(BuildComment.user), selectinload(BuildComment.replies).selectinload(BuildComment.user))
        .order_by(desc(BuildComment.created_at))
    )
    comments = result.scalars().all()

    def serialize(c: BuildComment) -> dict:
        return {
            "id": str(c.id),
            "text": c.text,
            "user_id": str(c.user_id),
            "user_name": c.user.name if c.user else "Удалённый",
            "user_avatar": c.user.avatar_url if c.user else None,
            "created_at": c.created_at.isoformat(),
            "replies": [serialize(r) for r in (c.replies or []) if not r.is_hidden],
        }

    return [serialize(c) for c in comments]


@router.post("/{build_id}/comments")
async def create_comment(
    build_id: uuid.UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a comment or reply."""
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Комментарий не может быть пустым")
    if len(data.text) > 2000:
        raise HTTPException(status_code=400, detail="Максимум 2000 символов")

    comment = BuildComment(
        build_id=build_id,
        user_id=current_user.id,
        parent_id=data.parent_id,
        text=data.text.strip(),
    )
    db.add(comment)
    await db.flush()

    return {
        "id": str(comment.id),
        "text": comment.text,
        "user_name": current_user.name,
        "user_avatar": current_user.avatar_url,
        "created_at": comment.created_at.isoformat(),
    }


# ── Recent comments (for sidebar) ───────────────────────────────────────────

@router.get("/recent-comments")
async def get_recent_comments(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Latest comments across all builds."""
    result = await db.execute(
        select(BuildComment)
        .where(BuildComment.is_hidden == False)  # noqa
        .options(selectinload(BuildComment.user))
        .order_by(desc(BuildComment.created_at))
        .limit(limit)
    )
    comments = result.scalars().all()

    # Get build info for each comment
    out = []
    for c in comments:
        build_result = await db.execute(select(Build.short_code, Build.title).where(Build.id == c.build_id))
        build_row = build_result.first()
        out.append({
            "id": str(c.id),
            "text": c.text[:100] + ("..." if len(c.text) > 100 else ""),
            "user_name": c.user.name if c.user else "Удалённый",
            "user_avatar": c.user.avatar_url if c.user else None,
            "build_code": build_row[0] if build_row else "",
            "build_title": build_row[1] if build_row else "",
            "created_at": c.created_at.isoformat(),
        })
    return out


# ── Tags ─────────────────────────────────────────────────────────────────────

@router.get("/tags/popular")
async def get_popular_tags(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get popular tags sorted by usage count."""
    result = await db.execute(
        select(Tag).where(Tag.usage_count > 0).order_by(desc(Tag.usage_count)).limit(limit)
    )
    tags = result.scalars().all()
    return [{"name": t.name, "count": t.usage_count} for t in tags]


async def sync_build_tags(db: AsyncSession, tags: list[str] | None):
    """Update tag usage counts when a build is created/updated."""
    if not tags:
        return
    for tag_name in tags:
        name = tag_name.strip().lower()
        if not name:
            continue
        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        if tag:
            tag.usage_count += 1
        else:
            db.add(Tag(name=name, usage_count=1))
