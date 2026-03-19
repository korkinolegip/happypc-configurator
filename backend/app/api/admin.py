import csv
import io
import os
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import ROLE_HIERARCHY, get_current_active_user, require_admin
from app.models.build import Build, BuildItem
from app.models.settings import AppSettings
from app.models.user import User, Workshop
from app.schemas.admin import (
    DashboardStats,
    MasterActivity,
    SettingUpdate,
    SettingsResponse,
    WorkshopCreate,
    WorkshopResponse,
)
from app.schemas.build import BuildListItem
from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserResponse
from app.services.auth import hash_password
from app.services.builds import calculate_totals

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
LOGO_DIR = os.path.join(UPLOAD_DIR, "logos")
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB


def _user_response(u: User) -> UserResponse:
    return UserResponse(
        id=u.id,
        email=u.email,
        name=u.name,
        avatar_url=u.avatar_url,
        role=u.role,
        workshop_id=u.workshop_id,
        workshop_name=u.workshop.name if u.workshop else None,
        gender=u.gender,
        city=u.city,
        phone=u.phone,
        telegram_username=u.telegram_username,
        vk_url=u.vk_url,
        is_active=u.is_active,
        created_at=u.created_at,
    )


# ============================================================
# USERS
# ============================================================

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    workshop_id: uuid.UUID | None = Query(None),
    role: str | None = Query(None),
    is_active: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).options(selectinload(User.workshop))

    # Admin can only see users in their own workshop (unless superadmin)
    if current_user.role == "admin" and current_user.workshop_id:
        query = query.where(User.workshop_id == current_user.workshop_id)
    elif workshop_id:
        query = query.where(User.workshop_id == workshop_id)

    if role:
        query = query.where(User.role == role)

    if is_active is not None:
        query = query.where(User.is_active == (is_active.lower() == "true"))

    if search:
        from sqlalchemy import or_

        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
                User.city.ilike(term),
            )
        )

    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return [_user_response(u) for u in users]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserAdminCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_data.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только суперадминистратор может создавать суперадминистраторов",
        )

    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    from app.api.auth import _random_avatar

    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        role=user_data.role,
        workshop_id=user_data.workshop_id,
        city=user_data.city,
        phone=user_data.phone,
        gender=user_data.gender,
        avatar_url=_random_avatar(user_data.gender or "male"),
    )
    db.add(new_user)
    await db.flush()

    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == new_user.id)
    )
    new_user = result.scalar_one()
    return _user_response(new_user)


@router.put("/users/{user_id}", response_model=UserResponse)
@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_data: UserAdminUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user_data.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только суперадминистратор может назначать роль суперадминистратора",
        )

    if user_data.name is not None:
        user.name = user_data.name
    if user_data.email is not None:
        # Check uniqueness
        existing = await db.execute(
            select(User).where(User.email == user_data.email, User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Этот email уже используется")
        user.email = user_data.email
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.workshop_id is not None:
        user.workshop_id = user_data.workshop_id or None
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password:
        user.password_hash = hash_password(user_data.password)
    if user_data.city is not None:
        user.city = user_data.city or None
    if user_data.phone is not None:
        user.phone = user_data.phone or None
    if user_data.gender is not None:
        user.gender = user_data.gender or None

    await db.flush()

    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == user_id)
    )
    user = result.scalar_one()
    return _user_response(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя удалить суперадминистратора",
        )

    if current_user.role == "admin" and user.workshop_id != current_user.workshop_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет прав на удаление этого пользователя",
        )

    await db.delete(user)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет прав на сброс пароля суперадминистратора",
        )

    new_password = secrets.token_urlsafe(10)
    user.password_hash = hash_password(new_password)
    await db.flush()

    return {"new_password": new_password, "message": "Пароль успешно сброшен"}


# ============================================================
# BUILDS (admin: view all, delete any)
# ============================================================

@router.get("/builds")
async def list_all_builds(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    author_id: str | None = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Build)

    if search:
        from sqlalchemy import or_

        term = f"%{search.strip()}%"
        query = query.join(User, Build.author_id == User.id, isouter=True).where(
            or_(
                Build.title.ilike(term),
                Build.short_code.ilike(term),
                User.name.ilike(term),
            )
        )

    if author_id:
        query = query.where(Build.author_id == author_id)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        query.order_by(desc(Build.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
    )
    result = await db.execute(query)
    builds = result.unique().scalars().all()

    items_out = []
    for b in builds:
        totals = calculate_totals(b.items, b.labor_percent, b.labor_price_manual)
        items_out.append({
            "id": str(b.id),
            "short_code": b.short_code,
            "title": b.title,
            "author_name": b.author.name if b.author else "Неизвестно",
            "author_avatar": b.author.avatar_url if b.author else None,
            "author_id": str(b.author_id) if b.author_id else None,
            "workshop_name": b.workshop.name if b.workshop else None,
            "is_public": b.is_public,
            "has_password": bool(b.password_hash),
            "total_price": totals["total_with_labor"],
            "items_count": len(b.items),
            "tags": b.tags or [],
            "created_at": b.created_at.isoformat(),
        })

    return {"items": items_out, "total": total, "page": page, "per_page": per_page}


@router.delete("/builds/{build_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_build(
    build_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Build).where(Build.id == build_id))
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(status_code=404, detail="Сборка не найдена")

    # Delete items first
    await db.execute(
        select(BuildItem).where(BuildItem.build_id == build_id)
    )
    from sqlalchemy import delete as sql_delete

    await db.execute(sql_delete(BuildItem).where(BuildItem.build_id == build_id))
    await db.delete(build)


# ============================================================
# DB MANAGEMENT
# ============================================================

@router.get("/export/users-csv")
async def export_users_csv(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Export all users as CSV."""
    result = await db.execute(
        select(User).options(selectinload(User.workshop)).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Имя", "Email", "Телефон", "Город", "Пол", "Роль",
        "Мастерская", "Telegram", "VK", "Активен", "Дата регистрации",
    ])
    for u in users:
        writer.writerow([
            str(u.id), u.name, u.email or "", u.phone or "", u.city or "",
            u.gender or "", u.role,
            u.workshop.name if u.workshop else "",
            u.telegram_username or "", u.vk_url or "",
            "Да" if u.is_active else "Нет",
            u.created_at.strftime("%d.%m.%Y %H:%M"),
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="users.csv"'},
    )


@router.get("/export/builds-csv")
async def export_builds_csv(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Export all builds as CSV."""
    result = await db.execute(
        select(Build)
        .options(selectinload(Build.author), selectinload(Build.workshop), selectinload(Build.items))
        .order_by(Build.created_at.desc())
    )
    builds = result.unique().scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Код", "Название", "Автор", "Мастерская", "Публичная",
        "Кол-во компонентов", "Итого", "Теги", "Дата создания",
    ])
    for b in builds:
        totals = calculate_totals(b.items, b.labor_percent, b.labor_price_manual)
        writer.writerow([
            str(b.id), b.short_code, b.title,
            b.author.name if b.author else "",
            b.workshop.name if b.workshop else "",
            "Да" if b.is_public else "Нет",
            len(b.items), totals["total_with_labor"],
            ", ".join(b.tags) if b.tags else "",
            b.created_at.strftime("%d.%m.%Y %H:%M"),
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="builds.csv"'},
    )


# ============================================================
# LOGO UPLOAD
# ============================================================

@router.post("/upload-logo/{logo_type}")
async def upload_logo(
    logo_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Upload header or PDF logo. logo_type: 'header' or 'pdf'."""
    if logo_type not in ("header", "pdf"):
        raise HTTPException(status_code=400, detail="Тип логотипа: header или pdf")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail=f"Формат не поддерживается. Разрешены: {', '.join(ALLOWED_IMAGE_EXT)}")

    content = await file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=413, detail="Файл слишком большой (макс. 2 МБ)")

    os.makedirs(LOGO_DIR, exist_ok=True)

    filename = f"{logo_type}_logo{ext}"
    filepath = os.path.join(LOGO_DIR, filename)

    import aiofiles

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    logo_url = f"/uploads/logos/{filename}"

    # Save to settings
    setting_key = f"{logo_type}_logo_url"
    result = await db.execute(select(AppSettings).where(AppSettings.key == setting_key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = logo_url
    else:
        db.add(AppSettings(key=setting_key, value=logo_url))
    await db.flush()

    return {"url": logo_url, "key": setting_key}


# ============================================================
# WORKSHOPS
# ============================================================

@router.get("/workshops", response_model=list[WorkshopResponse])
async def list_workshops(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workshop).order_by(Workshop.created_at.desc()))
    workshops = result.scalars().all()

    response = []
    for ws in workshops:
        masters_count_result = await db.execute(
            select(func.count(User.id)).where(User.workshop_id == ws.id)
        )
        masters_count = masters_count_result.scalar() or 0

        builds_count_result = await db.execute(
            select(func.count(Build.id)).where(Build.workshop_id == ws.id)
        )
        builds_count = builds_count_result.scalar() or 0

        response.append(
            WorkshopResponse(
                id=ws.id,
                name=ws.name,
                city=ws.city,
                masters_count=masters_count,
                builds_count=builds_count,
                created_at=ws.created_at,
            )
        )

    return response


@router.post("/workshops", response_model=WorkshopResponse, status_code=status.HTTP_201_CREATED)
async def create_workshop(
    ws_data: WorkshopCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    workshop = Workshop(name=ws_data.name, city=ws_data.city)
    db.add(workshop)
    await db.flush()
    await db.refresh(workshop)

    return WorkshopResponse(
        id=workshop.id,
        name=workshop.name,
        city=workshop.city,
        masters_count=0,
        builds_count=0,
        created_at=workshop.created_at,
    )


@router.put("/workshops/{workshop_id}", response_model=WorkshopResponse)
async def update_workshop(
    workshop_id: uuid.UUID,
    ws_data: WorkshopCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workshop).where(Workshop.id == workshop_id))
    workshop = result.scalar_one_or_none()

    if not workshop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Мастерская не найдена")

    workshop.name = ws_data.name
    workshop.city = ws_data.city
    await db.flush()

    masters_count_result = await db.execute(
        select(func.count(User.id)).where(User.workshop_id == workshop.id)
    )
    masters_count = masters_count_result.scalar() or 0

    builds_count_result = await db.execute(
        select(func.count(Build.id)).where(Build.workshop_id == workshop.id)
    )
    builds_count = builds_count_result.scalar() or 0

    return WorkshopResponse(
        id=workshop.id,
        name=workshop.name,
        city=workshop.city,
        masters_count=masters_count,
        builds_count=builds_count,
        created_at=workshop.created_at,
    )


@router.delete("/workshops/{workshop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workshop(
    workshop_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workshop).where(Workshop.id == workshop_id))
    workshop = result.scalar_one_or_none()

    if not workshop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Мастерская не найдена")

    await db.delete(workshop)


# ============================================================
# SETTINGS
# ============================================================

@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AppSettings))
    settings_rows = result.scalars().all()

    return SettingsResponse(settings={s.key: s.value for s in settings_rows})


@router.put("/settings", response_model=SettingsResponse)
async def update_settings_batch(
    updates: list[SettingUpdate],
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    for update in updates:
        result = await db.execute(select(AppSettings).where(AppSettings.key == update.key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = update.value
        else:
            setting = AppSettings(key=update.key, value=update.value)
            db.add(setting)

    await db.flush()

    result = await db.execute(select(AppSettings))
    all_settings = result.scalars().all()

    return SettingsResponse(settings={s.key: s.value for s in all_settings})


@router.patch("/settings", response_model=SettingsResponse)
async def patch_settings(
    updates: dict[str, str],
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update settings via flat key->value dict (frontend-friendly)."""
    for key, value in updates.items():
        if value is None:
            continue
        result = await db.execute(select(AppSettings).where(AppSettings.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
        else:
            setting = AppSettings(key=key, value=str(value))
            db.add(setting)

    await db.flush()

    result = await db.execute(select(AppSettings))
    all_settings = result.scalars().all()

    return SettingsResponse(settings={s.key: s.value for s in all_settings})


@router.put("/settings/{key}", response_model=SettingUpdate)
async def update_single_setting(
    key: str,
    update: SettingUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AppSettings).where(AppSettings.key == key))
    setting = result.scalar_one_or_none()

    if setting:
        setting.value = update.value
    else:
        setting = AppSettings(key=key, value=update.value)
        db.add(setting)

    await db.flush()
    return SettingUpdate(key=key, value=update.value)


# ============================================================
# DASHBOARD & ACTIVITY
# ============================================================

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0

    total_builds_result = await db.execute(select(func.count(Build.id)))
    total_builds = total_builds_result.scalar() or 0

    total_workshops_result = await db.execute(select(func.count(Workshop.id)))
    total_workshops = total_workshops_result.scalar() or 0

    recent_builds_result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .order_by(Build.created_at.desc())
        .limit(10)
    )
    recent_builds_rows = recent_builds_result.scalars().all()

    recent_builds = []
    for build in recent_builds_rows:
        totals = calculate_totals(build.items, build.labor_percent, build.labor_price_manual)
        recent_builds.append(
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

    # Masters activity
    masters_result = await db.execute(
        select(User)
        .options(selectinload(User.workshop))
        .where(User.role.in_(["master", "admin", "superadmin"]))
    )
    masters = masters_result.scalars().all()

    masters_activity = []
    for user in masters:
        bc_result = await db.execute(select(func.count(Build.id)).where(Build.author_id == user.id))
        bc = bc_result.scalar() or 0
        masters_activity.append(
            MasterActivity(
                id=user.id,
                name=user.name,
                avatar_url=user.avatar_url,
                role=user.role,
                workshop_name=user.workshop.name if user.workshop else None,
                builds_count=bc,
                last_activity=None,
            )
        )
    masters_activity.sort(key=lambda x: x.builds_count, reverse=True)

    return DashboardStats(
        users_count=total_users,
        builds_count=total_builds,
        workshops_count=total_workshops,
        recent_builds=recent_builds,
        masters_activity=masters_activity,
    )


@router.get("/activity", response_model=list[MasterActivity])
async def get_activity(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return masters activity: name, avatar, builds count, last activity."""
    users_result = await db.execute(
        select(User)
        .options(selectinload(User.workshop))
        .where(User.role.in_(["master", "admin", "superadmin"]))
        .order_by(User.name)
        .offset(skip)
        .limit(limit)
    )
    users = users_result.scalars().all()

    activity_list = []
    for user in users:
        builds_count_result = await db.execute(
            select(func.count(Build.id)).where(Build.author_id == user.id)
        )
        builds_count = builds_count_result.scalar() or 0

        last_build_result = await db.execute(
            select(Build.created_at)
            .where(Build.author_id == user.id)
            .order_by(Build.created_at.desc())
            .limit(1)
        )
        last_activity = last_build_result.scalar_one_or_none()

        activity_list.append(
            MasterActivity(
                id=user.id,
                name=user.name,
                avatar_url=user.avatar_url,
                role=user.role,
                workshop_name=user.workshop.name if user.workshop else None,
                builds_count=builds_count,
                last_activity=last_activity,
            )
        )

    activity_list.sort(key=lambda x: x.builds_count, reverse=True)
    return activity_list
