from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from io import BytesIO
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.build import Build
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

    keys = ["registration_enabled", "public_feed_enabled", "company_name", "telegram_bot_name", "vk_client_id"]
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
    db: AsyncSession = Depends(get_db),
):
    """List public builds without authentication."""
    from sqlalchemy import desc, asc
    from app.models.user import Workshop
    from app.models.user import User

    # Check if public feed is enabled
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == "public_feed_enabled")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value == "false":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Публичная лента отключена")

    from app.models.build import Build
    query = select(Build).where(Build.is_public == True, Build.password_hash == None)  # noqa
    if workshop_id:
        query = query.where(Build.workshop_id == workshop_id)
    if sort == "oldest":
        query = query.order_by(asc(Build.created_at))
    else:
        query = query.order_by(desc(Build.created_at))

    count_result = await db.execute(select(Build).where(Build.is_public == True, Build.password_hash == None))  # noqa
    total = len(count_result.scalars().all())

    query = query.offset((page - 1) * per_page).limit(per_page)
    query = query.options(selectinload(Build.author), selectinload(Build.workshop), selectinload(Build.items))
    result = await db.execute(query)
    builds = result.scalars().all()

    from app.services.builds import calculate_totals
    items_out = []
    for b in builds:
        totals = calculate_totals(b.items, b.labor_percent, b.labor_price_manual)
        items_out.append({
            "id": str(b.id),
            "short_code": b.short_code,
            "title": b.title,
            "author_name": b.author.name if b.author else "Неизвестно",
            "author_avatar": b.author.avatar_url if b.author else None,
            "workshop_name": b.workshop.name if b.workshop else None,
            "total_price": totals["hardware_total"],
            "items_count": len(b.items),
            "created_at": b.created_at.isoformat(),
        })
    return {"items": items_out, "total": total, "page": page, "per_page": per_page}


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
