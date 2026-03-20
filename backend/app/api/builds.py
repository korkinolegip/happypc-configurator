import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import ROLE_HIERARCHY, get_current_active_user
from app.models.build import Build, BuildItem
from app.models.user import User
from app.schemas.build import BuildCreate, BuildListItem, BuildResponse, BuildUpdate
from app.services.auth import hash_password, verify_password
from app.services.builds import calculate_totals, generate_short_code

router = APIRouter()


def build_to_response(build: Build) -> BuildResponse:
    totals = calculate_totals(build.items, build.labor_percent, build.labor_price_manual)
    return BuildResponse(
        id=build.id,
        short_code=build.short_code,
        title=build.title,
        description=build.description,
        author=build.author,
        workshop=build.workshop,
        is_public=build.is_public,
        has_password=bool(build.password_hash),
        items=build.items,
        total_price=totals["total_with_labor"],
        hardware_total=totals["hardware_total"],
        labor_cost=totals["labor_cost"],
        labor_percent=build.labor_percent,
        labor_price_manual=build.labor_price_manual,
        created_at=build.created_at,
        updated_at=build.updated_at,
    )


def build_to_list_item(build: Build) -> BuildListItem:
    totals = calculate_totals(build.items, build.labor_percent, build.labor_price_manual)
    return BuildListItem(
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


@router.get("")
async def list_builds(
    workshop_id: uuid.UUID | None = Query(None),
    author_id: uuid.UUID | None = Query(None),
    author: str | None = Query(None),  # text search by author name
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    my: bool = Query(False),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func, asc, desc as sa_desc

    base_query = select(Build).options(
        selectinload(Build.author),
        selectinload(Build.workshop),
        selectinload(Build.items),
    )

    role_level = ROLE_HIERARCHY.get(current_user.role, 0)

    if my:
        base_query = base_query.where(Build.author_id == current_user.id)
    elif role_level >= ROLE_HIERARCHY["admin"]:
        if workshop_id:
            base_query = base_query.where(Build.workshop_id == workshop_id)
        if author_id:
            base_query = base_query.where(Build.author_id == author_id)
        if author:
            base_query = base_query.join(User, Build.author_id == User.id).where(
                User.name.ilike(f"%{author}%")
            )
    elif role_level >= ROLE_HIERARCHY["master"]:
        if current_user.workshop_id:
            base_query = base_query.where(Build.workshop_id == current_user.workshop_id)
        else:
            base_query = base_query.where(Build.author_id == current_user.id)
    else:
        base_query = base_query.where(Build.author_id == current_user.id)

    if date_from:
        base_query = base_query.where(Build.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        base_query = base_query.where(Build.created_at <= datetime.combine(date_to, datetime.max.time()))

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    order = asc(Build.created_at) if sort == "oldest" else sa_desc(Build.created_at)
    paged_query = base_query.order_by(order).offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(paged_query)
    builds = result.scalars().all()

    return {
        "items": [build_to_list_item(b) for b in builds],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.post("", response_model=BuildResponse, status_code=status.HTTP_201_CREATED)
async def create_build(
    build_data: BuildCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Determine city: user's city or workshop's city
    city_name = current_user.city
    if not city_name and current_user.workshop:
        city_name = current_user.workshop.city if hasattr(current_user.workshop, 'city') else None
    short_code = await generate_short_code(db, city_name)

    # Sync tags
    if build_data.tags:
        from app.api.social import sync_build_tags
        await sync_build_tags(db, build_data.tags)

    build = Build(
        short_code=short_code,
        title=build_data.title,
        description=build_data.description,
        author_id=current_user.id,
        workshop_id=current_user.workshop_id,
        is_public=build_data.is_public,
        password_hash=hash_password(build_data.password) if build_data.password else None,
        tags=build_data.tags,
        labor_percent=build_data.labor_percent,
        labor_price_manual=build_data.labor_price_manual,
    )
    db.add(build)
    await db.flush()

    for idx, item_data in enumerate(build_data.items):
        item = BuildItem(
            build_id=build.id,
            category=item_data.category,
            name=item_data.name,
            url=item_data.url,
            price=item_data.price,
            sort_order=item_data.sort_order if item_data.sort_order else idx,
        )
        db.add(item)

    await db.flush()

    result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .where(Build.id == build.id)
    )
    build = result.scalar_one()

    return build_to_response(build)


@router.get("/{build_id}", response_model=BuildResponse)
async def get_build(
    build_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .where(Build.id == build_id)
    )
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сборка не найдена",
        )

    role_level = ROLE_HIERARCHY.get(current_user.role, 0)
    is_owner = build.author_id == current_user.id
    is_admin = role_level >= ROLE_HIERARCHY["admin"]
    is_same_workshop_master = (
        role_level >= ROLE_HIERARCHY["master"]
        and current_user.workshop_id is not None
        and build.workshop_id == current_user.workshop_id
    )

    if not (is_owner or is_admin or is_same_workshop_master):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к этой сборке",
        )

    return build_to_response(build)


@router.put("/{build_id}", response_model=BuildResponse)
async def update_build(
    build_id: uuid.UUID,
    build_data: BuildUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .where(Build.id == build_id)
    )
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сборка не найдена",
        )

    if build.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Редактировать сборку может только её автор",
        )

    if build_data.title is not None:
        build.title = build_data.title
    if build_data.description is not None:
        build.description = build_data.description
    if build_data.is_public is not None:
        build.is_public = build_data.is_public
    if build_data.labor_percent is not None:
        build.labor_percent = build_data.labor_percent
    if build_data.labor_price_manual is not None:
        build.labor_price_manual = build_data.labor_price_manual
    if build_data.password is not None:
        build.password_hash = hash_password(build_data.password) if build_data.password else None

    if build_data.items is not None:
        for item in build.items:
            await db.delete(item)
        await db.flush()

        for idx, item_data in enumerate(build_data.items):
            item = BuildItem(
                build_id=build.id,
                category=item_data.category,
                name=item_data.name,
                url=item_data.url,
                price=item_data.price,
                sort_order=item_data.sort_order if item_data.sort_order else idx,
            )
            db.add(item)

    build.updated_at = datetime.utcnow()
    await db.flush()

    result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .where(Build.id == build.id)
    )
    build = result.scalar_one()

    return build_to_response(build)


@router.delete("/{build_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_build(
    build_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Build).where(Build.id == build_id))
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сборка не найдена",
        )

    role_level = ROLE_HIERARCHY.get(current_user.role, 0)
    is_owner = build.author_id == current_user.id
    is_admin = role_level >= ROLE_HIERARCHY["admin"]

    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удалить сборку может только её автор или администратор",
        )

    await db.delete(build)


@router.post("/{build_id}/copy", response_model=BuildResponse, status_code=status.HTTP_201_CREATED)
async def copy_build(
    build_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Build)
        .options(selectinload(Build.items))
        .where(Build.id == build_id)
    )
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сборка не найдена",
        )

    # Determine city for the copy
    city_name = current_user.city
    if not city_name and current_user.workshop:
        city_name = current_user.workshop.city if hasattr(current_user.workshop, 'city') else None
    short_code = await generate_short_code(db, city_name)

    new_build = Build(
        short_code=short_code,
        title=f"Копия — {original.title}",
        description=original.description,
        author_id=current_user.id,
        workshop_id=current_user.workshop_id,
        is_public=original.is_public,
        password_hash=None,
        labor_percent=original.labor_percent,
        labor_price_manual=original.labor_price_manual,
    )
    db.add(new_build)
    await db.flush()

    for item in original.items:
        new_item = BuildItem(
            build_id=new_build.id,
            category=item.category,
            name=item.name,
            url=item.url,
            price=item.price,
            sort_order=item.sort_order,
        )
        db.add(new_item)

    await db.flush()

    result = await db.execute(
        select(Build)
        .options(
            selectinload(Build.author),
            selectinload(Build.workshop),
            selectinload(Build.items),
        )
        .where(Build.id == new_build.id)
    )
    new_build = result.scalar_one()

    return build_to_response(new_build)
