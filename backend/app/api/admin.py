import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import ROLE_HIERARCHY, get_current_active_user, require_admin
from app.models.build import Build
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


# ============================================================
# USERS
# ============================================================

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    workshop_id: uuid.UUID | None = Query(None),
    role: str | None = Query(None),
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

    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        UserResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            avatar_url=u.avatar_url,
            role=u.role,
            workshop_id=u.workshop_id,
            workshop_name=u.workshop.name if u.workshop else None,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserAdminCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Admins cannot create superadmins
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

    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        role=user_data.role,
        workshop_id=user_data.workshop_id,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    workshop_name = None
    if new_user.workshop_id:
        ws_result = await db.execute(select(Workshop).where(Workshop.id == new_user.workshop_id))
        ws = ws_result.scalar_one_or_none()
        workshop_name = ws.name if ws else None

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        avatar_url=new_user.avatar_url,
        role=new_user.role,
        workshop_id=new_user.workshop_id,
        workshop_name=workshop_name,
        created_at=new_user.created_at,
    )


@router.put("/users/{user_id}", response_model=UserResponse)
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

    # Cannot promote to superadmin unless current user is superadmin
    if user_data.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только суперадминистратор может назначать роль суперадминистратора",
        )

    if user_data.name is not None:
        user.name = user_data.name
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.workshop_id is not None:
        user.workshop_id = user_data.workshop_id
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password:
        user.password_hash = hash_password(user_data.password)

    await db.flush()

    workshop_name = None
    if user.workshop_id:
        ws_result = await db.execute(select(Workshop).where(Workshop.id == user.workshop_id))
        ws = ws_result.scalar_one_or_none()
        workshop_name = ws.name if ws else None

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=user.role,
        workshop_id=user.workshop_id,
        workshop_name=workshop_name,
        created_at=user.created_at,
    )


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

    # Admin can only delete users in their workshop
    if current_user.role == "admin" and user.workshop_id != current_user.workshop_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет прав на удаление этого пользователя",
        )

    await db.delete(user)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID,
    new_password: str,
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

    user.password_hash = hash_password(new_password)
    await db.flush()

    return {"message": "Пароль успешно сброшен"}


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
    """Update settings via flat key→value dict (frontend-friendly)."""
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

    # Sort by builds count descending
    activity_list.sort(key=lambda x: x.builds_count, reverse=True)
    return activity_list
