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
from app.schemas.user import ChangePassword, UserResponse, UserUpdate
from app.services.auth import hash_password, verify_password
from app.services.builds import calculate_totals

router = APIRouter()

UPLOAD_DIR = "/app/uploads/avatars"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=user.role,
        workshop_id=user.workshop_id,
        workshop_name=user.workshop.name if user.workshop else None,
        gender=user.gender,
        city=user.city,
        phone=user.phone,
        telegram_username=user.telegram_username,
        vk_url=user.vk_url,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    return _user_response(current_user)


@router.put("", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if user_update.name is not None:
        if len(user_update.name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Имя должно содержать минимум 2 символа")
        current_user.name = user_update.name.strip()
    if user_update.email is not None:
        # Check email uniqueness
        existing = await db.execute(
            select(User).where(User.email == user_update.email, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Этот email уже используется")
        current_user.email = user_update.email
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    if user_update.city is not None:
        current_user.city = user_update.city.strip() or None
    if user_update.phone is not None:
        current_user.phone = user_update.phone.strip() or None
    if user_update.gender is not None:
        if user_update.gender not in ("male", "female", ""):
            raise HTTPException(status_code=400, detail="Пол: male или female")
        current_user.gender = user_update.gender or None

    await db.flush()
    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == current_user.id)
    )
    updated_user = result.scalar_one()
    return _user_response(updated_user)


@router.post("/change-password")
async def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="У вас нет пароля (вход через соцсеть). Обратитесь к администратору.",
        )

    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")

    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Новый пароль должен содержать минимум 6 символов")

    current_user.password_hash = hash_password(data.new_password)
    await db.flush()

    return {"message": "Пароль успешно изменён"}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a profile avatar image."""
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
