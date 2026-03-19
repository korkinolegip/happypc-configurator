import random
import string
from datetime import datetime, date

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.build import Build, BuildItem
from app.models.city import City
from app.services.auth import verify_password


def calculate_totals(
    items: list,
    labor_percent: float,
    labor_price_manual: float | None,
) -> dict:
    """
    Calculate hardware total, labor cost, and grand total.
    """
    hardware_total = sum(item.price if hasattr(item, "price") else item["price"] for item in items)
    labor_cost = round(hardware_total * labor_percent / 100, 2)
    total_with_labor = round(hardware_total + labor_cost, 2)
    total_turnkey = None
    if labor_price_manual is not None:
        total_turnkey = round(hardware_total + labor_price_manual, 2)

    return {
        "hardware_total": round(hardware_total, 2),
        "labor_cost": labor_cost,
        "total_with_labor": total_with_labor,
        "total_turnkey": total_turnkey,
    }


async def generate_short_code(db: AsyncSession, city_name: str | None = None) -> str:
    """
    Generate a short code like VRN200326001.
    Format: CITY_CODE + DDMMYY + SEQ (3+ digits).

    If city is not found, falls back to 'XXX'.
    """
    # Get city code
    city_code = "XXX"
    if city_name:
        result = await db.execute(select(City).where(City.name == city_name))
        city = result.scalar_one_or_none()
        if city:
            city_code = city.code

    # Date part: DDMMYY
    now = datetime.now()
    date_part = now.strftime("%d%m%y")

    # Count builds with same prefix today to determine sequence number
    prefix = f"{city_code}{date_part}"

    result = await db.execute(
        select(func.count()).select_from(
            select(Build).where(Build.short_code.like(f"{prefix}%")).subquery()
        )
    )
    count = result.scalar() or 0
    seq = count + 1

    # Format sequence: 3 digits minimum, grows if needed
    seq_str = f"{seq:03d}" if seq < 1000 else str(seq)

    short_code = f"{prefix}{seq_str}"

    # Verify uniqueness (edge case)
    existing = await db.execute(select(Build).where(Build.short_code == short_code))
    if existing.scalar_one_or_none():
        # Increment until unique
        for i in range(seq + 1, seq + 100):
            seq_str = f"{i:03d}" if i < 1000 else str(i)
            candidate = f"{prefix}{seq_str}"
            check = await db.execute(select(Build).where(Build.short_code == candidate))
            if not check.scalar_one_or_none():
                return candidate
        raise RuntimeError("Could not generate unique short code")

    return short_code


async def get_build_by_code(
    db: AsyncSession,
    short_code: str,
    password: str | None = None,
) -> Build:
    """
    Retrieve a build by its short code.
    If the build has a password set, the provided password must match.
    """
    result = await db.execute(
        select(Build).where(Build.short_code == short_code)
    )
    build = result.scalar_one_or_none()

    if not build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сборка не найдена",
        )

    if build.password_hash:
        if not password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Эта сборка защищена паролем",
            )
        if not verify_password(password, build.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Неверный пароль",
            )

    return build
