import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.settings import AppSettings
from app.models.user import User
from app.schemas.auth import TelegramAuthData, Token, UserCreate, UserInToken, UserLogin
from app.schemas.user import UserResponse
from app.services.auth import (
    create_access_token,
    get_vk_access_token,
    hash_password,
    verify_password,
    verify_telegram_auth,
)

router = APIRouter()


async def _make_token(user: User, db: AsyncSession) -> Token:
    """Create a Token response with user data included."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).options(selectinload(User.workshop)).where(User.id == user.id)
    )
    u = result.scalar_one()
    token = create_access_token({"sub": str(u.id)})
    return Token(
        access_token=token,
        user=UserInToken(
            id=u.id,
            email=u.email,
            name=u.name,
            avatar_url=u.avatar_url,
            role=u.role,
            workshop_id=u.workshop_id,
            workshop_name=u.workshop.name if u.workshop else None,
            created_at=u.created_at,
        ),
    )


async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(AppSettings).where(AppSettings.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else default


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    registration_enabled = await get_setting(db, "registration_enabled", "true")
    if registration_enabled.lower() not in ("true", "1", "yes"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Регистрация в данный момент закрыта",
        )

    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        role="user",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return await _make_token(user, db)


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    return await _make_token(user, db)


@router.post("/logout")
async def logout():
    return {"message": "Выход выполнен успешно"}


@router.get("/telegram", response_model=Token)
async def telegram_auth(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Telegram Login Widget callback.
    Accepts query parameters: id, first_name, last_name, username, photo_url, auth_date, hash
    """
    params = dict(request.query_params)

    required = {"id", "first_name", "auth_date", "hash"}
    missing = required - set(params.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Отсутствуют обязательные параметры Telegram: {missing}",
        )

    try:
        tg_data = TelegramAuthData(
            id=int(params["id"]),
            first_name=params["first_name"],
            last_name=params.get("last_name"),
            username=params.get("username"),
            photo_url=params.get("photo_url"),
            auth_date=int(params["auth_date"]),
            hash=params["hash"],
        )
    except (ValueError, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверные данные Telegram: {e}",
        )

    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram авторизация не настроена",
        )

    if not verify_telegram_auth(tg_data, bot_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Проверка подписи Telegram не пройдена",
        )

    telegram_id_str = str(tg_data.id)
    result = await db.execute(select(User).where(User.telegram_id == telegram_id_str))
    user = result.scalar_one_or_none()

    if not user:
        name = tg_data.first_name
        if tg_data.last_name:
            name = f"{name} {tg_data.last_name}"

        user = User(
            telegram_id=telegram_id_str,
            name=name,
            avatar_url=tg_data.photo_url,
            role="user",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт деактивирован",
            )

    return await _make_token(user, db)


@router.get("/vk")
async def vk_auth_redirect():
    """Redirect to VK OAuth authorization page."""
    if not settings.VK_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VK авторизация не настроена",
        )

    params = {
        "client_id": settings.VK_CLIENT_ID,
        "display": "popup",
        "redirect_uri": settings.VK_REDIRECT_URI,
        "scope": "email",
        "response_type": "code",
        "v": "5.131",
    }
    vk_url = "https://oauth.vk.com/authorize?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=vk_url)


@router.get("/vk/callback", response_model=Token)
async def vk_auth_callback(
    code: str = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle VK OAuth callback, exchange code for token, find or create user."""
    if not settings.VK_CLIENT_ID or not settings.VK_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VK авторизация не настроена",
        )

    try:
        vk_response = await get_vk_access_token(code, settings.VK_REDIRECT_URI)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка получения токена VK: {e}",
        )

    if "error" in vk_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VK вернул ошибку: {vk_response.get('error_description', vk_response['error'])}",
        )

    vk_user_id = str(vk_response.get("user_id", ""))
    vk_email = vk_response.get("email")

    if not vk_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK не вернул идентификатор пользователя",
        )

    result = await db.execute(select(User).where(User.vk_id == vk_user_id))
    user = result.scalar_one_or_none()

    if not user:
        import httpx as _httpx

        name = "VK User"
        avatar_url = None

        try:
            async with _httpx.AsyncClient() as client:
                vk_info = await client.get(
                    "https://api.vk.com/method/users.get",
                    params={
                        "user_ids": vk_user_id,
                        "fields": "photo_200",
                        "access_token": vk_response.get("access_token", ""),
                        "v": "5.131",
                    },
                )
                vk_info_data = vk_info.json()
                if "response" in vk_info_data and vk_info_data["response"]:
                    vk_user = vk_info_data["response"][0]
                    name = f"{vk_user.get('first_name', '')} {vk_user.get('last_name', '')}".strip()
                    avatar_url = vk_user.get("photo_200")
        except Exception:
            pass

        user = User(
            vk_id=vk_user_id,
            email=vk_email if vk_email else None,
            name=name or "VK User",
            avatar_url=avatar_url,
            role="user",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт деактивирован",
            )

    return await _make_token(user, db)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    workshop_name = current_user.workshop.name if current_user.workshop else None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        workshop_id=current_user.workshop_id,
        workshop_name=workshop_name,
        created_at=current_user.created_at,
    )
