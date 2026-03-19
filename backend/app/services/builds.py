import random
import string

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.build import Build, BuildItem
from app.services.auth import verify_password


def calculate_totals(
    items: list,
    labor_percent: float,
    labor_price_manual: float | None,
) -> dict:
    """
    Calculate hardware total, labor cost, and grand total.

    Returns:
        hardware_total: sum of all item prices
        labor_cost: hardware_total * labor_percent / 100
        total_with_labor: hardware_total + labor_cost
        total_turnkey: hardware_total + labor_price_manual (if set)
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


async def generate_short_code(db: AsyncSession) -> str:
    """Generate a unique 6-character alphanumeric short code."""
    chars = string.ascii_letters + string.digits
    for _ in range(20):
        code = "".join(random.choices(chars, k=6))
        result = await db.execute(select(Build).where(Build.short_code == code))
        existing = result.scalar_one_or_none()
        if not existing:
            return code
    raise RuntimeError("Could not generate unique short code after 20 attempts")


async def get_build_by_code(
    db: AsyncSession,
    short_code: str,
    password: str | None = None,
) -> Build:
    """
    Retrieve a build by its short code.
    If the build has a password set, the provided password must match.
    Raises 404 if not found, 403 if password is wrong or missing.
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
