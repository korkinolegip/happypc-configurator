import os
import uuid
from datetime import datetime

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.build import Build
from app.models.user import User
from app.schemas.build import BuildListItem
from app.schemas.user import UserResponse, UserUpdate
from app.services.builds import calculate_totals

router = APIRouter()

UPLOAD_DIR = "/app/uploads/avatars"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.get("", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    workshop_name = current_user.workshop.name if current_user.workshop else None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        workshop_id=current_user.workshop_id,
        workshop_name=workshop_name,
        created_at=current_user.created_at,
    )


@router.put("", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url

    await db.flush()
    # Reload user with workshop eagerly to avoid lazy-load in async context
    result = await db.execute(
        select(User)
        .options(selectinload(User.workshop))
        .where(User.id == current_user.id)
    )
    updated_user = result.scalar_one()

    workshop_name = updated_user.workshop.name if updated_user.workshop else None
    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        name=updated_user.name,
        avatar_url=updated_user.avatar_url,
        role=updated_user.role,
        workshop_id=updated_user.workshop_id,
        workshop_name=workshop_name,
        created_at=updated_user.created_at,
    )


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a profile avatar image. Saves to /app/uploads/avatars/."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя файла не может быть пустым",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый формат файла. Разрешены: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Файл слишком большой. Максимальный размер: 5 МБ",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    avatar_url = f"/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    await db.flush()

    return {"avatar_url": avatar_url}


@router.get("/builds", response_model=list[BuildListItem])
async def get_my_builds(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .where(Build.author_id == current_user.id)
        .order_by(Build.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    builds = result.scalars().all()

    items_list = []
    for build in builds:
        totals = calculate_totals(build.items, build.labor_percent, build.labor_price_manual)
        items_list.append(
            BuildListItem(
                id=build.id,
                short_code=build.short_code,
                title=build.title,
                author_name=build.author.name if build.author else "Неизвестно",
                author_avatar=build.author.avatar_url if build.author else None,
                workshop_name=build.workshop.name if build.workshop else None,
                total_price=totals["total_with_labor"],
                items_count=len(build.items),
                created_at=build.created_at,
            )
        )

    return items_list
