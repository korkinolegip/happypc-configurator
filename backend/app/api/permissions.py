from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user, require_admin
from app.models.permissions import RolePermission, DEFAULT_PERMISSIONS, PERMISSION_LABELS
from app.models.user import User

router = APIRouter()

ROLES = ["user", "master", "admin", "superadmin"]


async def get_role_permissions(db: AsyncSession, role: str) -> dict[str, bool]:
    """Get merged permissions for a role (DB overrides defaults)."""
    defaults = {k: v.get(role, False) for k, v in DEFAULT_PERMISSIONS.items()}

    result = await db.execute(
        select(RolePermission).where(RolePermission.role == role)
    )
    db_perms = result.scalars().all()

    for p in db_perms:
        defaults[p.permission] = p.enabled

    return defaults


@router.get("/my")
async def get_my_permissions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get permissions for the current user's role."""
    return await get_role_permissions(db, current_user.role)


@router.get("/all")
async def get_all_permissions(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get permissions matrix for all roles (admin only)."""
    matrix = {}
    for role in ROLES:
        matrix[role] = await get_role_permissions(db, role)
    return {
        "roles": ROLES,
        "permissions": list(DEFAULT_PERMISSIONS.keys()),
        "labels": PERMISSION_LABELS,
        "matrix": matrix,
    }


@router.put("/update")
async def update_permissions(
    data: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update permissions. Body: { "role": "user", "permission": "can_see_labor", "enabled": false }
    """
    role = data.get("role")
    permission = data.get("permission")
    enabled = data.get("enabled", True)

    if role not in ROLES or permission not in DEFAULT_PERMISSIONS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Неверная роль или разрешение")

    result = await db.execute(
        select(RolePermission).where(
            RolePermission.role == role,
            RolePermission.permission == permission,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.enabled = enabled
    else:
        db.add(RolePermission(role=role, permission=permission, enabled=enabled))

    await db.flush()

    return {"role": role, "permission": permission, "enabled": enabled}
