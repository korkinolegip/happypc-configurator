import csv
import io
import os
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
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
        email_verified=u.email_verified,
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
    if user_data.avatar_url is not None:
        user.avatar_url = user_data.avatar_url
    if user_data.email_verified is not None:
        user.email_verified = user_data.email_verified

    await db.flush()

    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == user_id)
    )
    user = result.scalar_one()
    return _user_response(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    reason: str | None = Query(None),
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

    # Snapshot user data
    user_data = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "gender": user.gender,
        "city": user.city,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "workshop_id": str(user.workshop_id) if user.workshop_id else None,
        "telegram_id": user.telegram_id,
        "telegram_username": user.telegram_username,
        "vk_id": user.vk_id,
        "vk_url": user.vk_url,
        "email_verified": user.email_verified,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    # Snapshot builds + items (separate queries to avoid SA cascade issues)
    from sqlalchemy.orm import selectinload as _sl
    builds_result = await db.execute(
        select(Build).options(_sl(Build.items)).where(Build.author_id == user_id)
    )
    builds = builds_result.scalars().all()
    builds_data = []
    for build in builds:
        builds_data.append({
            "id": str(build.id),
            "short_code": build.short_code,
            "title": build.title,
            "description": build.description,
            "workshop_id": str(build.workshop_id) if build.workshop_id else None,
            "is_public": build.is_public,
            "labor_percent": build.labor_percent,
            "labor_price_manual": build.labor_price_manual,
            "tags": build.tags,
            "install_os": build.install_os,
            "created_at": build.created_at.isoformat() if build.created_at else None,
            "items": [
                {"category": it.category, "name": it.name, "url": it.url, "price": it.price, "sort_order": it.sort_order}
                for it in build.items
            ],
        })

    # Save to trash
    from app.models.trash import DeletedUser
    trash = DeletedUser(
        user_data=user_data,
        builds_data=builds_data,
        deleted_by_name=current_user.name,
        reason=reason,
    )
    db.add(trash)

    # Delete user via raw SQL to let DB CASCADE handle builds/likes/comments
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(User).where(User.id == user_id))
    await db.flush()


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

    data = {}
    for s in settings_rows:
        # Mask sensitive values
        if s.key == "smtp_password" and s.value:
            data[s.key] = "••••••••"
        else:
            data[s.key] = s.value
    return SettingsResponse(settings=data)


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
        # Don't overwrite password with masked placeholder
        if key == "smtp_password" and value == "••••••••":
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

    from app.models.bug_report import BugReport as BR
    bugs_count_result = await db.execute(select(func.count(BR.id)).where(BR.status == "new"))
    open_bugs = bugs_count_result.scalar() or 0

    from app.models.store import Store as StoreModel
    stores_count_result = await db.execute(select(func.count(StoreModel.id)))
    total_stores = stores_count_result.scalar() or 0

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
                labor_cost=totals["labor_cost"],
                install_os=getattr(build, "install_os", False) or False,
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
        bugs_count=open_bugs,
        stores_count=total_stores,
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


# ============================================================
# BANNERS (info blocks on homepage)
# ============================================================

@router.get("/banners")
async def list_banners(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.banner import Banner
    result = await db.execute(select(Banner).order_by(Banner.position, Banner.created_at.desc()))
    banners = result.scalars().all()
    return [
        {
            "id": str(b.id), "title": b.title, "text": b.text,
            "button_text": b.button_text, "button_url": b.button_url, "button_color": b.button_color,
            "button2_text": b.button2_text, "button2_url": b.button2_url, "button2_color": b.button2_color,
            "position": b.position, "is_active": b.is_active,
            "created_at": b.created_at.isoformat(),
        }
        for b in banners
    ]


@router.post("/banners", status_code=status.HTTP_201_CREATED)
async def create_banner(
    data: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.banner import Banner
    banner = Banner(
        title=data.get("title", ""),
        text=data.get("text"),
        button_text=data.get("button_text"),
        button_url=data.get("button_url"),
        button_color=data.get("button_color"),
        button2_text=data.get("button2_text"),
        button2_url=data.get("button2_url"),
        button2_color=data.get("button2_color"),
        position=data.get("position", 0),
        is_active=data.get("is_active", True),
    )
    db.add(banner)
    await db.flush()
    await db.refresh(banner)
    return {
        "id": str(banner.id), "title": banner.title, "text": banner.text,
        "button_text": banner.button_text, "button_url": banner.button_url, "button_color": banner.button_color,
        "button2_text": banner.button2_text, "button2_url": banner.button2_url, "button2_color": banner.button2_color,
        "position": banner.position, "is_active": banner.is_active,
    }


@router.put("/banners/{banner_id}")
async def update_banner(
    banner_id: uuid.UUID,
    data: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.banner import Banner
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(status_code=404, detail="Баннер не найден")
    if "title" in data:
        banner.title = data["title"]
    if "text" in data:
        banner.text = data["text"]
    if "button_text" in data:
        banner.button_text = data["button_text"]
    if "button_url" in data:
        banner.button_url = data["button_url"]
    if "button_color" in data:
        banner.button_color = data["button_color"]
    if "button2_text" in data:
        banner.button2_text = data["button2_text"]
    if "button2_url" in data:
        banner.button2_url = data["button2_url"]
    if "button2_color" in data:
        banner.button2_color = data["button2_color"]
    if "position" in data:
        banner.position = data["position"]
    if "is_active" in data:
        banner.is_active = data["is_active"]
    await db.flush()
    return {
        "id": str(banner.id), "title": banner.title, "text": banner.text,
        "button_text": banner.button_text, "button_url": banner.button_url, "button_color": banner.button_color,
        "button2_text": banner.button2_text, "button2_url": banner.button2_url, "button2_color": banner.button2_color,
        "position": banner.position, "is_active": banner.is_active,
    }


@router.delete("/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_banner(
    banner_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.banner import Banner
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(status_code=404, detail="Баннер не найден")
    await db.delete(banner)


# ============================================================
# COMMENTS MODERATION
# ============================================================

@router.get("/comments")
async def list_comments(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.social import BuildComment
    from sqlalchemy.orm import selectinload as si

    count_result = await db.execute(select(func.count()).select_from(BuildComment))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(BuildComment)
        .options(si(BuildComment.user))
        .order_by(desc(BuildComment.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    comments = result.scalars().all()

    items = []
    for c in comments:
        build_r = await db.execute(select(Build.short_code, Build.title).where(Build.id == c.build_id))
        build_row = build_r.first()
        items.append({
            "id": str(c.id),
            "text": c.text,
            "user_name": c.user.name if c.user else "Удалён",
            "user_avatar": c.user.avatar_url if c.user else None,
            "build_code": build_row[0] if build_row else "",
            "build_title": build_row[1] if build_row else "",
            "is_hidden": c.is_hidden,
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "created_at": c.created_at.isoformat(),
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/comments/{comment_id}/toggle-hide")
async def toggle_hide_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.social import BuildComment
    result = await db.execute(select(BuildComment).where(BuildComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    comment.is_hidden = not comment.is_hidden
    await db.flush()
    return {"is_hidden": comment.is_hidden}


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.social import BuildComment
    result = await db.execute(select(BuildComment).where(BuildComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    await db.delete(comment)


# ============================================================
# DB BACKUP
# ============================================================

@router.get("/db/backups")
async def list_backups(
    current_user: User = Depends(require_admin),
):
    """List available DB backups."""
    import os
    backup_dir = "/app/backups"
    os.makedirs(backup_dir, exist_ok=True)
    files = []
    for f in sorted(os.listdir(backup_dir), reverse=True):
        if f.endswith(".sql") or f.endswith(".sql.gz"):
            path = os.path.join(backup_dir, f)
            stat = os.stat(path)
            files.append({
                "name": f,
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return files


@router.post("/db/backup")
async def create_backup(
    current_user: User = Depends(require_admin),
):
    """Create a pg_dump backup."""
    import asyncio
    backup_dir = "/app/backups"
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"happypc_{timestamp}.sql.gz"
    filepath = os.path.join(backup_dir, filename)

    proc = await asyncio.create_subprocess_exec(
        "bash", "-c",
        f'PGPASSWORD=happypc2024 pg_dump -h 127.0.0.1 -U happypc happypc | gzip > {filepath}',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Ошибка создания бэкапа: {stderr.decode()}")

    stat = os.stat(filepath)
    return {
        "name": filename,
        "size": stat.st_size,
        "created_at": datetime.now().isoformat(),
        "message": "Бэкап создан успешно",
    }


@router.get("/db/backup/{filename}")
async def download_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Download a backup file."""
    filepath = os.path.join("/app/backups", filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Файл не найден")

    from starlette.responses import FileResponse
    return FileResponse(filepath, filename=filename)


@router.post("/db/restore/{filename}")
async def restore_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Restore from a backup file. DANGEROUS — overwrites current DB."""
    import asyncio
    filepath = os.path.join("/app/backups", filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Файл не найден")

    # First create a safety backup
    safety = f"/app/backups/pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql.gz"
    await asyncio.create_subprocess_exec(
        "bash", "-c",
        f'PGPASSWORD=happypc2024 pg_dump -h 127.0.0.1 -U happypc happypc | gzip > {safety}',
    )

    cmd = f'gunzip -c {filepath} | PGPASSWORD=happypc2024 psql -h 127.0.0.1 -U happypc happypc' if filepath.endswith('.gz') else f'PGPASSWORD=happypc2024 psql -h 127.0.0.1 -U happypc happypc < {filepath}'

    proc = await asyncio.create_subprocess_exec(
        "bash", "-c", cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        return {"status": "error", "detail": stderr.decode()[:500]}

    return {"status": "restored", "safety_backup": os.path.basename(safety)}


@router.delete("/db/backup/{filename}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Delete a backup file. Cannot delete the last 3 backups."""
    backup_dir = "/app/backups"
    filepath = os.path.join(backup_dir, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Файл не найден")

    # Get all backups sorted by date (newest first)
    all_files = sorted(
        [f for f in os.listdir(backup_dir) if f.endswith(".sql") or f.endswith(".sql.gz")],
        key=lambda f: os.path.getmtime(os.path.join(backup_dir, f)),
        reverse=True,
    )

    # Protect last 3
    if filename in all_files[:3]:
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить один из последних 3 бэкапов",
        )

    os.remove(filepath)


# ============================================================
# STORES
# ============================================================

@router.get("/stores")
async def list_stores(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.store import Store
    result = await db.execute(select(Store).order_by(Store.position, Store.created_at.desc()))
    stores = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "slug": s.slug,
            "name": s.name,
            "short_label": s.short_label,
            "color": s.color,
            "url_patterns": s.url_patterns,
            "icon_path": s.icon_path,
            "icon_url": s.icon_path if s.icon_path else None,
            "is_auto": s.is_auto,
            "position": s.position,
            "created_at": s.created_at.isoformat(),
        }
        for s in stores
    ]


@router.post("/stores", status_code=status.HTTP_201_CREATED)
async def create_store(
    data: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.store import Store
    import re

    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название магазина обязательно")

    slug = data.get("slug") or re.sub(r"[^a-z0-9-]", "", name.lower().replace(" ", "-"))

    # Check slug uniqueness
    existing = await db.execute(select(Store).where(Store.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Магазин с таким slug уже существует")

    store = Store(
        slug=slug,
        name=name,
        short_label=data.get("short_label", name[:3].upper()),
        color=data.get("color", "#888888"),
        url_patterns=data.get("url_patterns", []),
        is_auto=data.get("is_auto", False),
        position=data.get("position", 0),
    )
    db.add(store)
    await db.flush()
    await db.refresh(store)

    return {
        "id": str(store.id),
        "slug": store.slug,
        "name": store.name,
        "short_label": store.short_label,
        "color": store.color,
        "url_patterns": store.url_patterns,
        "icon_path": store.icon_path,
        "icon_url": store.icon_path if store.icon_path else None,
        "is_auto": store.is_auto,
        "position": store.position,
        "created_at": store.created_at.isoformat(),
    }


@router.put("/stores/{store_slug}")
async def update_store(
    store_slug: str,
    data: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.store import Store

    result = await db.execute(select(Store).where(Store.slug == store_slug))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    if "name" in data:
        store.name = data["name"]
    if "slug" in data:
        # Check uniqueness
        existing = await db.execute(
            select(Store).where(Store.slug == data["slug"], Store.id != store.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Магазин с таким slug уже существует")
        store.slug = data["slug"]
    if "short_label" in data:
        store.short_label = data["short_label"]
    if "color" in data:
        store.color = data["color"]
    if "url_patterns" in data:
        store.url_patterns = data["url_patterns"]
    if "icon_path" in data:
        store.icon_path = data["icon_path"]
    if "is_auto" in data:
        store.is_auto = data["is_auto"]
    if "position" in data:
        store.position = data["position"]

    await db.flush()

    return {
        "id": str(store.id),
        "slug": store.slug,
        "name": store.name,
        "short_label": store.short_label,
        "color": store.color,
        "url_patterns": store.url_patterns,
        "icon_path": store.icon_path,
        "icon_url": store.icon_path if store.icon_path else None,
        "is_auto": store.is_auto,
        "position": store.position,
        "created_at": store.created_at.isoformat(),
    }


@router.delete("/stores/{store_slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store(
    store_slug: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.store import Store

    result = await db.execute(select(Store).where(Store.slug == store_slug))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    await db.delete(store)


@router.post("/stores/{store_slug}/upload-icon")
async def upload_store_icon(
    store_slug: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.store import Store

    result = await db.execute(select(Store).where(Store.slug == store_slug))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Формат не поддерживается. Разрешены: {', '.join(ALLOWED_IMAGE_EXT)}",
        )

    content = await file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=413, detail="Файл слишком большой (макс. 2 МБ)")

    icon_dir = "/app/uploads/store-icons"
    os.makedirs(icon_dir, exist_ok=True)

    filename = f"{store.slug}{ext}"
    filepath = os.path.join(icon_dir, filename)

    import aiofiles

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    store.icon_path = f"/uploads/store-icons/{filename}"
    await db.flush()

    return {"icon_url": store.icon_path}


@router.post("/stores/{store_slug}/fetch-icon")
async def fetch_store_icon(
    store_slug: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.store import Store
    from app.services.favicon import fetch_favicon

    result = await db.execute(select(Store).where(Store.slug == store_slug))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    if not store.url_patterns:
        raise HTTPException(status_code=400, detail="У магазина нет url_patterns для получения иконки")

    domain = store.url_patterns[0]
    icon_path = await fetch_favicon(domain, store.slug)

    if not icon_path:
        raise HTTPException(status_code=422, detail="Не удалось получить иконку")

    store.icon_path = icon_path
    await db.flush()

    return {"icon_url": store.icon_path}


# ============================================================
# EMAIL
# ============================================================

@router.post("/email/test")
async def test_email_send(
    body: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Send a test email using current SMTP configuration."""
    from app.services.email import get_smtp_config, send_test_email

    to_email = body.get("to_email", "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Укажите email получателя")

    smtp_cfg = await get_smtp_config(db)
    success = await send_test_email(to_email, smtp_cfg)

    if success:
        return {"message": f"Тестовое письмо отправлено на {to_email}"}
    raise HTTPException(status_code=500, detail="Ошибка отправки. Проверьте SMTP настройки.")


# ============================================================
# TRASH (deleted users)
# ============================================================

@router.get("/trash")
async def list_trash(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.trash import DeletedUser as DU
    result = await db.execute(select(DU).order_by(DU.deleted_at.desc()))
    items = result.scalars().all()
    return [
        {
            "id": str(it.id),
            "user_name": it.user_data.get("name", ""),
            "user_email": it.user_data.get("email", ""),
            "user_role": it.user_data.get("role", ""),
            "builds_count": len(it.builds_data),
            "deleted_by_name": it.deleted_by_name,
            "reason": it.reason,
            "deleted_at": it.deleted_at.isoformat() if it.deleted_at else None,
        }
        for it in items
    ]


@router.post("/trash/{trash_id}/restore")
async def restore_user(
    trash_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Restore a deleted user and their builds from trash."""
    from app.models.trash import DeletedUser as DU
    result = await db.execute(select(DU).where(DU.id == trash_id))
    trash = result.scalar_one_or_none()
    if not trash:
        raise HTTPException(status_code=404, detail="Запись в корзине не найдена")

    ud = trash.user_data

    # Check email/social uniqueness conflicts
    if ud.get("email"):
        existing = await db.execute(select(User).where(User.email == ud["email"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Пользователь с email {ud['email']} уже существует")
    if ud.get("telegram_id"):
        existing = await db.execute(select(User).where(User.telegram_id == ud["telegram_id"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Пользователь с таким Telegram ID уже существует")
    if ud.get("vk_id"):
        existing = await db.execute(select(User).where(User.vk_id == ud["vk_id"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Пользователь с таким VK ID уже существует")

    # Recreate user
    from datetime import datetime, timezone
    user = User(
        email=ud.get("email"),
        name=ud.get("name", "Restored User"),
        phone=ud.get("phone"),
        gender=ud.get("gender"),
        city=ud.get("city"),
        role=ud.get("role", "user"),
        avatar_url=ud.get("avatar_url"),
        workshop_id=uuid.UUID(ud["workshop_id"]) if ud.get("workshop_id") else None,
        telegram_id=ud.get("telegram_id"),
        telegram_username=ud.get("telegram_username"),
        vk_id=ud.get("vk_id"),
        vk_url=ud.get("vk_url"),
        email_verified=ud.get("email_verified", False),
        is_active=ud.get("is_active", True),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Recreate builds
    import secrets
    for bd in trash.builds_data:
        # Generate new short_code (old one might be taken)
        code = bd.get("short_code", secrets.token_urlsafe(6)[:8])
        existing_code = await db.execute(select(Build).where(Build.short_code == code))
        if existing_code.scalar_one_or_none():
            code = secrets.token_urlsafe(6)[:8]

        build = Build(
            short_code=code,
            title=bd.get("title", ""),
            description=bd.get("description"),
            author_id=user.id,
            workshop_id=uuid.UUID(bd["workshop_id"]) if bd.get("workshop_id") else None,
            is_public=bd.get("is_public", True),
            labor_percent=bd.get("labor_percent", 7.0),
            labor_price_manual=bd.get("labor_price_manual"),
            tags=bd.get("tags"),
            install_os=bd.get("install_os", False),
        )
        db.add(build)
        await db.flush()

        for item_data in bd.get("items", []):
            item = BuildItem(
                build_id=build.id,
                category=item_data.get("category", ""),
                name=item_data.get("name", ""),
                url=item_data.get("url"),
                price=item_data.get("price", 0),
                sort_order=item_data.get("sort_order", 0),
            )
            db.add(item)

    # Remove from trash
    await db.delete(trash)
    await db.flush()

    return {"message": f"Пользователь {ud.get('name')} и {len(trash.builds_data)} сборок восстановлены"}


@router.delete("/trash/{trash_id}", status_code=status.HTTP_204_NO_CONTENT)
async def permanent_delete_trash(
    trash_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a trash entry."""
    from app.models.trash import DeletedUser as DU
    result = await db.execute(select(DU).where(DU.id == trash_id))
    trash = result.scalar_one_or_none()
    if not trash:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await db.delete(trash)


@router.delete("/trash", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_trash(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete all trash entries."""
    from app.models.trash import DeletedUser as DU
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(DU))
    await db.flush()


# ============================================================
# BUG REPORTS
# ============================================================

@router.get("/bugs")
async def list_bugs(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.bug_report import BugReport
    from sqlalchemy.orm import selectinload as _sl
    result = await db.execute(
        select(BugReport).options(_sl(BugReport.comments)).order_by(BugReport.created_at.desc())
    )
    bugs = result.scalars().unique().all()

    out = []
    for b in bugs:
        name = b.reporter_name
        if b.reporter_id and not name:
            u_result = await db.execute(select(User).where(User.id == b.reporter_id))
            u = u_result.scalar_one_or_none()
            if u:
                name = u.name
        out.append({
            "id": str(b.id),
            "description": b.description,
            "screenshot_url": b.screenshot_url,
            "page_url": b.page_url,
            "reporter_name": name or "Аноним",
            "status": b.status,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "comments": [
                {
                    "id": str(c.id),
                    "author_name": c.author_name,
                    "text": c.text,
                    "screenshots": c.screenshots or [],
                    "new_status": c.new_status,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in b.comments
            ],
        })
    return out


@router.patch("/bugs/{bug_id}")
async def update_bug_status(
    bug_id: uuid.UUID,
    body: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.bug_report import BugReport
    result = await db.execute(select(BugReport).where(BugReport.id == bug_id))
    bug = result.scalar_one_or_none()
    if not bug:
        raise HTTPException(status_code=404, detail="Баг не найден")
    new_status = body.get("status")
    if new_status and new_status in ("new", "in_progress", "done", "needs_rework"):
        bug.status = new_status
    await db.flush()
    return {"status": bug.status}


@router.post("/bugs/{bug_id}/comments")
async def add_bug_comment(
    bug_id: uuid.UUID,
    text: str = Form(...),
    new_status: str | None = Form(None),
    screenshots: list[UploadFile] = File(default=[]),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a comment to a bug report, optionally changing status."""
    import os
    import aiofiles
    from app.models.bug_report import BugReport, BugComment

    result = await db.execute(select(BugReport).where(BugReport.id == bug_id))
    bug = result.scalar_one_or_none()
    if not bug:
        raise HTTPException(status_code=404, detail="Баг не найден")

    # Upload screenshots
    screenshot_urls = []
    upload_dir = "/app/uploads/bugs"
    os.makedirs(upload_dir, exist_ok=True)
    for file in screenshots:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
            continue
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            continue
        fname = f"{uuid.uuid4()}{ext}"
        async with aiofiles.open(os.path.join(upload_dir, fname), "wb") as f:
            await f.write(content)
        screenshot_urls.append(f"/uploads/bugs/{fname}")

    # Update status if provided
    if new_status and new_status in ("new", "in_progress", "done", "needs_rework"):
        bug.status = new_status

    comment = BugComment(
        bug_id=bug.id,
        author_name=current_user.name,
        text=text.strip(),
        screenshots=screenshot_urls or None,
        new_status=new_status if new_status in ("new", "in_progress", "done", "needs_rework") else None,
    )
    db.add(comment)
    await db.flush()

    # Send Telegram notification
    try:
        await _notify_bug_telegram(db, bug, comment)
    except Exception:
        pass

    return {
        "id": str(comment.id),
        "author_name": comment.author_name,
        "text": comment.text,
        "screenshots": comment.screenshots or [],
        "new_status": comment.new_status,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


@router.delete("/bugs/{bug_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bug(
    bug_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.bug_report import BugReport
    result = await db.execute(select(BugReport).where(BugReport.id == bug_id))
    bug = result.scalar_one_or_none()
    if not bug:
        raise HTTPException(status_code=404, detail="Баг не найден")
    await db.delete(bug)


async def _notify_bug_telegram(db, bug, comment=None):
    """Send Telegram notification about bug status change."""
    import httpx
    from app.models.settings import AppSettings

    # Get settings
    result = await db.execute(select(AppSettings).where(AppSettings.key == "bug_telegram_chat_id"))
    chat_setting = result.scalar_one_or_none()
    if not chat_setting or not chat_setting.value:
        return

    result = await db.execute(select(AppSettings).where(AppSettings.key == "bug_telegram_bot_token"))
    token_setting = result.scalar_one_or_none()
    if not token_setting or not token_setting.value:
        return

    chat_ids = [c.strip() for c in chat_setting.value.split(",") if c.strip()]
    bot_token = token_setting.value.strip()
    if not chat_ids or not bot_token:
        return

    status_labels = {"new": "Новый", "in_progress": "В работе", "done": "Выполнен", "needs_rework": "Доработка"}
    status_emoji = {"new": "🆕", "in_progress": "🔧", "done": "✅", "needs_rework": "⚠️"}

    if comment:
        text = (
            f"{status_emoji.get(comment.new_status or '', '💬')} <b>Баг #{str(bug.id)[:8]}</b>\n"
            f"<b>Статус:</b> {status_labels.get(bug.status, bug.status)}\n"
            f"<b>Комментарий от {comment.author_name}:</b>\n{comment.text}\n"
        )
    else:
        text = (
            f"🐛 <b>Новый баг-репорт</b>\n"
            f"<b>Описание:</b> {bug.description[:200]}\n"
            f"<b>От:</b> {bug.reporter_name or 'Аноним'}\n"
        )
    if bug.page_url:
        text += f"<b>Страница:</b> {bug.page_url}\n"

    async with httpx.AsyncClient() as client:
        for chat_id in chat_ids:
            try:
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                    timeout=5,
                )
            except Exception:
                pass
