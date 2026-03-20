from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from io import BytesIO
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.build import Build
from app.models.city import City
from app.models.user import User
from app.models.settings import AppSettings
from app.schemas.build import AuthorInfo, BuildItemResponse, BuildPublicResponse, WorkshopInfo
from app.services.builds import calculate_totals, get_build_by_code
from app.services.pdf import generate_build_pdf
from app.services.url_parser import parse_product_url

router = APIRouter()


class ParseUrlRequest(BaseModel):
    url: str


@router.post("/parse-url")
async def parse_url(body: ParseUrlRequest):
    """Parse a product URL and return name, price, store."""
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Некорректный URL")
    result = await parse_product_url(url)
    # Always return something — even if just store detection worked
    if not result:
        raise HTTPException(status_code=422, detail="Не удалось получить данные по ссылке")
    return result  # {store, name?, price?}


@router.get("/settings")
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    """Return public-safe settings (no auth required)."""
    from app.config import settings as app_settings

    keys = [
        "registration_enabled", "public_feed_enabled", "company_name",
        "telegram_bot_name", "vk_client_id",
        "contact_block_text", "contact_tg_url", "contact_tg_label",
        "contact_vk_url", "contact_vk_label",
        "help_block_text", "help_block_url", "help_block_label",
    ]
    result = await db.execute(select(AppSettings).where(AppSettings.key.in_(keys)))
    rows = result.scalars().all()
    data = {row.key: row.value for row in rows}

    # Fallback to env vars for telegram/vk if not in DB
    if not data.get("telegram_bot_name") and app_settings.TELEGRAM_BOT_TOKEN:
        # Don't expose token — bot name must be set in DB settings
        pass
    if not data.get("vk_client_id") and app_settings.VK_CLIENT_ID:
        data["vk_client_id"] = app_settings.VK_CLIENT_ID

    return data


@router.get("/builds")
async def get_public_builds(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    sort: str = Query("newest"),
    workshop_id: str | None = Query(None),
    city: str | None = Query(None),
    price_from: float | None = Query(None),
    price_to: float | None = Query(None),
    tag: str | None = Query(None),
    search: str | None = Query(None),
    author_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List public builds with multi-filtering and smart search."""
    from sqlalchemy import desc, asc, func as sa_func, or_, cast, String as SAString
    from app.models.user import Workshop, User
    from app.models.build import Build, BuildItem

    # Check if public feed is enabled
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == "public_feed_enabled")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value == "false":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Публичная лента отключена")

    query = (
        select(Build)
        .join(User, Build.author_id == User.id, isouter=True)
        .join(Workshop, Build.workshop_id == Workshop.id, isouter=True)
        .where(Build.is_public == True, Build.password_hash == None)  # noqa
    )

    # City filter (user city or workshop city)
    if city:
        query = query.where(
            or_(User.city.ilike(f"%{city}%"), Workshop.city.ilike(f"%{city}%"))
        )

    # Workshop filter
    if workshop_id:
        query = query.where(Build.workshop_id == workshop_id)

    # Author filter
    if author_id:
        query = query.where(Build.author_id == author_id)

    # Tag filter
    if tag:
        query = query.where(Build.tags.any(tag))

    # Smart search — searches across: author name, build title, component names, price, date
    if search:
        search_term = search.strip()
        conditions = [
            User.name.ilike(f"%{search_term}%"),
            Build.title.ilike(f"%{search_term}%"),
            Build.description.ilike(f"%{search_term}%"),
        ]

        # Check if search is a number (price search)
        clean_num = search_term.replace(" ", "").replace(",", ".")
        if clean_num.replace(".", "").isdigit():
            pass  # price filtering handled below

        # Check if search looks like a date
        import re
        date_match = re.match(
            r'^(\d{1,2})[./\s](\d{1,2})(?:[./\s](\d{2,4}))?$', search_term
        )
        if date_match:
            day, month = int(date_match.group(1)), int(date_match.group(2))
            year = date_match.group(3)
            if year:
                year = int(year)
                if year < 100:
                    year += 2000
            # Filter by date
            from datetime import datetime, date
            try:
                if year:
                    target = date(year, month, day)
                    query = query.where(
                        sa_func.date(Build.created_at) == target
                    )
                else:
                    query = query.where(
                        sa_func.extract('day', Build.created_at) == day,
                        sa_func.extract('month', Build.created_at) == month,
                    )
            except (ValueError, OverflowError):
                pass
        else:
            # Text search: also search in component names via subquery
            component_subq = (
                select(BuildItem.build_id)
                .where(BuildItem.name.ilike(f"%{search_term}%"))
                .distinct()
                .subquery()
            )
            conditions.append(Build.id.in_(select(component_subq)))
            query = query.where(or_(*conditions))

    # Sort
    if sort == "oldest":
        query = query.order_by(asc(Build.created_at))
    elif sort == "price_asc":
        pass  # sorted after totals calculation
    elif sort == "price_desc":
        pass
    else:
        query = query.order_by(desc(Build.created_at))

    # Count (efficient SQL count)
    from sqlalchemy import func as count_func
    count_q = select(count_func.count()).select_from(query.subquery())
    count_result = await db.execute(count_q)
    total = count_result.scalar() or 0

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    query = query.options(
        selectinload(Build.author), selectinload(Build.workshop), selectinload(Build.items)
    )
    result = await db.execute(query)
    builds = result.unique().scalars().all()

    from app.services.builds import calculate_totals
    items_out = []
    for b in builds:
        totals = calculate_totals(b.items, b.labor_percent, b.labor_price_manual)
        total_price = totals["total_with_labor"]

        # Price range filter (applied after calculation)
        if price_from and total_price < price_from:
            continue
        if price_to and total_price > price_to:
            continue

        author_city = b.author.city if b.author and b.author.city else None
        ws_city = b.workshop.city if b.workshop and b.workshop.city else None

        # Component summary (category + name for each filled item)
        components = [
            {"category": item.category, "name": item.name}
            for item in sorted(b.items, key=lambda x: x.sort_order)
            if item.name and item.name.strip()
        ]

        # Stats
        from app.models.social import BuildView, BuildLike, BuildComment
        views_count = (await db.execute(
            select(sa_func.count()).where(BuildView.build_id == b.id)
        )).scalar() or 0
        likes_count = (await db.execute(
            select(sa_func.count()).where(BuildLike.build_id == b.id)
        )).scalar() or 0
        comments_count = (await db.execute(
            select(sa_func.count()).where(BuildComment.build_id == b.id, BuildComment.is_hidden == False)  # noqa
        )).scalar() or 0

        items_out.append({
            "id": str(b.id),
            "short_code": b.short_code,
            "title": b.title,
            "author_name": b.author.name if b.author else "Неизвестно",
            "author_avatar": b.author.avatar_url if b.author else None,
            "author_id": str(b.author_id),
            "workshop_name": b.workshop.name if b.workshop else None,
            "city": author_city or ws_city,
            "total_price": total_price,
            "items_count": len(b.items),
            "components": components,
            "tags": b.tags or [],
            "views_count": views_count,
            "likes_count": likes_count,
            "comments_count": comments_count,
            "created_at": b.created_at.isoformat(),
        })

    # Price sort (post-query since price is calculated)
    if sort == "price_asc":
        items_out.sort(key=lambda x: x["total_price"])
    elif sort == "price_desc":
        items_out.sort(key=lambda x: x["total_price"], reverse=True)

    return {"items": items_out, "total": total, "page": page, "per_page": per_page}


@router.get("/user/{user_id}")
async def get_user_public_profile(
    user_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Public user profile with their public builds."""
    import uuid as _uuid
    from sqlalchemy import desc, func as sa_func

    try:
        uid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный ID пользователя")

    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == uid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Count builds
    count_result = await db.execute(
        select(sa_func.count()).where(Build.author_id == uid, Build.is_public == True)  # noqa
    )
    builds_count = count_result.scalar() or 0

    # Get builds
    builds_q = (
        select(Build)
        .where(Build.author_id == uid, Build.is_public == True, Build.password_hash == None)  # noqa
        .order_by(desc(Build.created_at))
        .offset((page - 1) * per_page).limit(per_page)
        .options(selectinload(Build.author), selectinload(Build.workshop), selectinload(Build.items))
    )
    builds_result = await db.execute(builds_q)
    builds = builds_result.scalars().all()

    from app.services.builds import calculate_totals
    builds_out = []
    for b in builds:
        totals = calculate_totals(b.items, b.labor_percent, b.labor_price_manual)
        builds_out.append({
            "id": str(b.id),
            "short_code": b.short_code,
            "title": b.title,
            "total_price": totals["total_with_labor"],
            "items_count": len(b.items),
            "tags": b.tags or [],
            "created_at": b.created_at.isoformat(),
        })

    return {
        "user": {
            "id": str(user.id),
            "name": user.name,
            "avatar_url": user.avatar_url,
            "role": user.role,
            "city": user.city,
            "workshop_name": user.workshop.name if user.workshop else None,
            "telegram_username": user.telegram_username,
            "vk_url": user.vk_url,
            "builds_count": builds_count,
            "created_at": user.created_at.isoformat(),
        },
        "builds": builds_out,
        "total": builds_count,
        "page": page,
        "per_page": per_page,
    }


@router.get("/avatars")
async def get_available_avatars():
    """Return list of available default avatars by gender."""
    import os
    avatars = {"male": [], "female": []}
    for gender in ["male", "female"]:
        avatar_dir = f"/app/static/avatars/{gender}"
        if os.path.isdir(avatar_dir):
            files = sorted(
                [f for f in os.listdir(avatar_dir) if f.endswith((".png", ".jpg", ".svg", ".webp"))],
                key=lambda x: int(x.split(".")[0]) if x.split(".")[0].isdigit() else 0,
            )
            avatars[gender] = [f"/static/avatars/{gender}/{f}?v=4" for f in files]
    return avatars


@router.get("/banners")
async def get_active_banners(db: AsyncSession = Depends(get_db)):
    """Return active banners for homepage."""
    from app.models.banner import Banner
    result = await db.execute(
        select(Banner).where(Banner.is_active == True).order_by(Banner.position)  # noqa
    )
    banners = result.scalars().all()
    return [
        {
            "id": str(b.id), "title": b.title, "text": b.text,
            "button_text": b.button_text, "button_url": b.button_url, "button_color": b.button_color,
            "button2_text": b.button2_text, "button2_url": b.button2_url, "button2_color": b.button2_color,
            "position": b.position,
        }
        for b in banners
    ]


@router.get("/cities")
async def get_cities(
    with_builds: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Return list of cities. If with_builds=true, only cities that have builds."""
    if with_builds:
        from sqlalchemy import distinct
        from app.models.user import User as U

        # Get cities where users have builds
        result = await db.execute(
            select(distinct(U.city)).join(Build, Build.author_id == U.id).where(
                U.city.isnot(None), U.city != "", Build.is_public == True  # noqa
            )
        )
        active_cities = [row[0] for row in result.all() if row[0]]

        # Also check workshop cities
        from app.models.user import Workshop as W

        ws_result = await db.execute(
            select(distinct(W.city)).join(Build, Build.workshop_id == W.id).where(
                W.city.isnot(None), W.city != "", Build.is_public == True  # noqa
            )
        )
        ws_cities = [row[0] for row in ws_result.all() if row[0]]

        all_active = sorted(set(active_cities + ws_cities))
        return [{"name": c} for c in all_active]

    # All cities from the cities table
    result = await db.execute(select(City).order_by(City.name))
    cities = result.scalars().all()
    return [{"name": c.name, "code": c.code} for c in cities]


@router.get("/{short_code}", response_model=BuildPublicResponse)
async def get_public_build(
    short_code: str,
    password: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a build by its short code without authentication.
    If the build has a password, the ?password= query param must be provided.
    """
    build = await get_build_by_code(db, short_code, password)

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

    totals = calculate_totals(build.items, build.labor_percent, build.labor_price_manual)

    workshop_info = None
    if build.workshop:
        workshop_info = WorkshopInfo(
            id=build.workshop.id,
            name=build.workshop.name,
            city=build.workshop.city,
        )

    author_info = AuthorInfo(
        id=build.author.id if build.author else build.id,
        name=build.author.name if build.author else "Неизвестно",
        avatar_url=build.author.avatar_url if build.author else None,
    )

    return BuildPublicResponse(
        id=build.id,
        short_code=build.short_code,
        title=build.title,
        description=build.description,
        author=author_info,
        workshop=workshop_info,
        is_public=build.is_public,
        has_password=bool(build.password_hash),
        items=[
            BuildItemResponse(
                id=item.id,
                category=item.category,
                name=item.name,
                url=item.url,
                price=item.price,
                sort_order=item.sort_order,
            )
            for item in build.items
        ],
        total_price=totals["total_with_labor"],
        hardware_total=totals["hardware_total"],
        labor_cost=totals["labor_cost"],
        labor_percent=build.labor_percent,
        labor_price_manual=build.labor_price_manual,
        tags=build.tags,
        install_os=getattr(build, 'install_os', False),
        created_at=build.created_at,
        updated_at=build.updated_at,
    )


@router.get("/{short_code}/pdf")
async def get_public_build_pdf(
    short_code: str,
    password: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Generate and return a PDF for the build."""
    build = await get_build_by_code(db, short_code, password)

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

    author_name = build.author.name if build.author else "Неизвестно"
    workshop_name = build.workshop.name if build.workshop else None

    pdf_bytes = await generate_build_pdf(build, author_name, workshop_name)

    filename = f"HappyPC_{build.short_code}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
