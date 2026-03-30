import asyncio
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.settings import AppSettings
from app.models.user import User
from app.schemas.auth import (
    EmailVerifyRequest,
    TelegramAuthData,
    Token,
    UserCreate,
    UserInToken,
    UserLogin,
)
from app.schemas.user import UserResponse
from app.services.auth import (
    create_access_token,
    generate_pkce_pair,
    get_vk_access_token,
    get_vk_user_info,
    hash_password,
    verify_password,
    verify_telegram_auth,
)
from app.services.email import send_verification_email

router = APIRouter()


def _generate_verification_code() -> str:
    """Generate a secure 6-digit verification code."""
    return str(secrets.randbelow(900000) + 100000)


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
            gender=u.gender,
            city=u.city,
            email_verified=u.email_verified,
            created_at=u.created_at,
        ),
    )


async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(AppSettings).where(AppSettings.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else default


def _random_avatar(gender: str) -> str:
    """Pick a random cyberpunk avatar based on gender."""
    import os
    import random
    folder = "male" if gender == "male" else "female"
    avatar_dir = f"/app/static/avatars/{folder}"
    try:
        files = [f for f in os.listdir(avatar_dir) if f.endswith((".png", ".jpg", ".svg", ".webp"))]
        if files:
            chosen = random.choice(files)
            return f"/static/avatars/{folder}/{chosen}"
    except OSError:
        pass
    return f"/static/avatars/{folder}/1.png"


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

    # Generate verification code
    verification_code = _generate_verification_code()

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        phone=user_data.phone,
        gender=user_data.gender,
        city=user_data.city,
        avatar_url=_random_avatar(user_data.gender),
        role="user",
        email_verified=False,
        email_verification_token=verification_code,
        email_verification_sent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Send verification email in background (don't block response)
    asyncio.create_task(
        send_verification_email(user_data.email, verification_code, user.name)
    )

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


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

@router.post("/verify-email")
async def verify_email(
    body: EmailVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify user's email with the 6-digit code."""
    if current_user.email_verified:
        return {"message": "Email уже подтверждён", "email_verified": True}

    if not current_user.email_verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код подтверждения не был отправлен. Запросите новый код.",
        )

    # Check expiration (24 hours)
    if current_user.email_verification_sent_at:
        expires_at = current_user.email_verification_sent_at + timedelta(hours=24)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код подтверждения истёк. Запросите новый код.",
            )

    # Verify code
    if body.code.strip() != current_user.email_verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код подтверждения",
        )

    # Mark email as verified
    current_user.email_verified = True
    current_user.email_verification_token = None
    current_user.email_verification_sent_at = None
    await db.flush()
    await db.refresh(current_user)

    workshop_name = current_user.workshop.name if current_user.workshop else None
    return {
        "message": "Email успешно подтверждён",
        "email_verified": True,
        "user": UserResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            avatar_url=current_user.avatar_url,
            role=current_user.role,
            workshop_id=current_user.workshop_id,
            workshop_name=workshop_name,
            gender=current_user.gender,
            city=current_user.city,
            phone=current_user.phone,
            telegram_username=current_user.telegram_username,
            vk_url=current_user.vk_url,
            email_verified=current_user.email_verified,
            is_active=current_user.is_active,
            created_at=current_user.created_at,
        ),
    }


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend email verification code. Rate limited to 1 per 60 seconds."""
    if current_user.email_verified:
        return {"message": "Email уже подтверждён"}

    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У пользователя не указан email",
        )

    # Rate limit: 60 seconds between sends
    if current_user.email_verification_sent_at:
        elapsed = datetime.now(timezone.utc) - current_user.email_verification_sent_at
        if elapsed < timedelta(seconds=60):
            remaining = 60 - int(elapsed.total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Подождите {remaining} сек. перед повторной отправкой",
            )

    # Generate new code
    verification_code = _generate_verification_code()
    current_user.email_verification_token = verification_code
    current_user.email_verification_sent_at = datetime.now(timezone.utc)
    await db.flush()

    # Send in background
    asyncio.create_task(
        send_verification_email(current_user.email, verification_code, current_user.name)
    )

    return {"message": "Код подтверждения отправлен повторно"}


# ---------------------------------------------------------------------------
# Telegram OAuth
# ---------------------------------------------------------------------------

@router.get("/telegram", response_model=Token)
async def telegram_auth(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Telegram Login Widget callback (JSON API response).
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
            telegram_username=tg_data.username,
            name=name,
            avatar_url=tg_data.photo_url or _random_avatar("male"),
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
        # Update avatar/username if changed in Telegram
        if tg_data.photo_url and tg_data.photo_url != user.avatar_url:
            user.avatar_url = tg_data.photo_url
        if tg_data.username and tg_data.username != user.telegram_username:
            user.telegram_username = tg_data.username

    return await _make_token(user, db)


@router.get("/telegram/callback")
async def telegram_auth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Telegram OAuth callback — verifies hash and redirects to frontend with JWT.
    Used when Telegram redirects the browser back to the app.
    """
    import time

    params = dict(request.query_params)

    required = {"id", "first_name", "auth_date", "hash"}
    missing = required - set(params.keys())
    if missing:
        error_msg = urllib.parse.quote("Отсутствуют обязательные параметры Telegram")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=telegram"
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
    except (ValueError, KeyError):
        error_msg = urllib.parse.quote("Неверные данные Telegram")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=telegram"
        )

    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        error_msg = urllib.parse.quote("Telegram авторизация не настроена")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=telegram"
        )

    # Verify hash
    if not verify_telegram_auth(tg_data, bot_token):
        error_msg = urllib.parse.quote("Проверка подписи Telegram не пройдена")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=telegram"
        )

    # Check auth_date is within 5 minutes
    now = int(time.time())
    if abs(now - tg_data.auth_date) > 300:
        error_msg = urllib.parse.quote("Данные авторизации Telegram устарели")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=telegram"
        )

    # Find or create user
    telegram_id_str = str(tg_data.id)
    result = await db.execute(select(User).where(User.telegram_id == telegram_id_str))
    user = result.scalar_one_or_none()

    if not user:
        name = tg_data.first_name
        if tg_data.last_name:
            name = f"{name} {tg_data.last_name}"

        user = User(
            telegram_id=telegram_id_str,
            telegram_username=tg_data.username,
            name=name,
            avatar_url=tg_data.photo_url or _random_avatar("male"),
            role="user",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if not user.is_active:
            error_msg = urllib.parse.quote("Аккаунт деактивирован")
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=telegram"
            )
        # Update avatar/username if changed in Telegram
        if tg_data.photo_url and tg_data.photo_url != user.avatar_url:
            user.avatar_url = tg_data.photo_url
        if tg_data.username and tg_data.username != user.telegram_username:
            user.telegram_username = tg_data.username

    # Check if profile is incomplete (no email, phone, city)
    needs_profile = not user.email or not user.phone or not user.city

    # Generate JWT and redirect to frontend
    jwt_token = create_access_token({"sub": str(user.id)})
    redirect_url = f"{settings.FRONTEND_URL}/login?token={jwt_token}&provider=telegram"
    if needs_profile:
        redirect_url += "&complete_profile=1"
    return RedirectResponse(url=redirect_url)


# ---------------------------------------------------------------------------
# VK OAuth
# ---------------------------------------------------------------------------

@router.get("/vk")
async def vk_auth_redirect():
    """Redirect to VK ID authorization page with PKCE."""
    if not settings.VK_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VK авторизация не настроена",
        )

    import uuid as _uuid
    state = str(_uuid.uuid4())
    code_verifier, code_challenge = generate_pkce_pair()

    params = {
        "client_id": settings.VK_CLIENT_ID,
        "redirect_uri": settings.VK_REDIRECT_URI,
        "response_type": "code",
        "scope": "vkid.personal_info email phone",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "s256",
    }
    vk_url = "https://id.vk.com/authorize?" + urllib.parse.urlencode(params)
    response = RedirectResponse(url=vk_url)
    response.set_cookie(
        "vk_cv", code_verifier,
        httponly=True, secure=True, samesite="lax", max_age=600,
    )
    return response


@router.get("/vk/callback")
async def vk_auth_callback(
    request: Request,
    code: str = Query(...),
    state: str | None = Query(None),
    device_id: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Handle VK ID callback with PKCE, exchange code for token, redirect to frontend."""
    import logging
    logger = logging.getLogger("vk_auth")
    logger.warning("VK callback params: %s", dict(request.query_params))

    # Read PKCE code_verifier from cookie
    code_verifier = request.cookies.get("vk_cv", "")

    def _error_redirect(msg: str) -> RedirectResponse:
        error_msg = urllib.parse.quote(msg)
        resp = RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}&provider=vk"
        )
        resp.delete_cookie("vk_cv")
        return resp

    if not settings.VK_CLIENT_ID:
        return _error_redirect("VK авторизация не настроена")

    try:
        vk_response = await get_vk_access_token(
            code, settings.VK_REDIRECT_URI, device_id, code_verifier,
        )
        logger.warning("VK token response: %s", vk_response)
    except Exception as e:
        logger.warning("VK token exchange error: %s", e)
        return _error_redirect(f"Ошибка получения токена VK: {e}")

    if "error" in vk_response:
        desc = vk_response.get("error_description", vk_response.get("error", "unknown"))
        return _error_redirect(desc)

    access_token = vk_response.get("access_token", "")
    vk_user_id = str(vk_response.get("user_id", ""))

    # Get user info from VK ID
    vk_email = None
    vk_phone = None
    vk_gender = None
    name = "VK User"
    avatar_url = None

    try:
        user_info = await get_vk_user_info(access_token)
        logger.warning("VK user_info response: %s", user_info)
        user_data = user_info.get("user", user_info)
        vk_user_id = str(user_data.get("user_id", vk_user_id))
        name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip() or "VK User"
        vk_email = user_data.get("email")
        vk_phone = user_data.get("phone")
        # VK sex: 1=female, 2=male
        vk_sex = user_data.get("sex")
        if vk_sex == 2:
            vk_gender = "male"
        elif vk_sex == 1:
            vk_gender = "female"
        avatar_url = user_data.get("avatar_url") or user_data.get("photo_200")
    except Exception:
        pass

    if not vk_user_id:
        return _error_redirect("VK не вернул идентификатор пользователя")

    # 1) Find by vk_id
    result = await db.execute(select(User).where(User.vk_id == vk_user_id))
    user = result.scalar_one_or_none()

    # 2) If not found by vk_id but email matches — link VK to existing account
    if not user and vk_email:
        result = await db.execute(select(User).where(User.email == vk_email))
        user = result.scalar_one_or_none()
        if user:
            user.vk_id = vk_user_id
            user.vk_url = f"https://vk.com/id{vk_user_id}"
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            if vk_phone and not user.phone:
                user.phone = vk_phone
            if vk_gender and not user.gender:
                user.gender = vk_gender

    # 3) Create new user if not found
    if not user:
        user = User(
            vk_id=vk_user_id,
            vk_url=f"https://vk.com/id{vk_user_id}",
            email=vk_email,
            name=name,
            phone=vk_phone,
            gender=vk_gender,
            avatar_url=avatar_url or _random_avatar(vk_gender or "male"),
            role="user",
            email_verified=bool(vk_email),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if not user.is_active:
            return _error_redirect("Аккаунт деактивирован")

    # Check if profile is incomplete
    needs_profile = not user.email or not user.phone or not user.city

    # Generate JWT and redirect to frontend
    jwt_token = create_access_token({"sub": str(user.id)})
    redirect_url = f"{settings.FRONTEND_URL}/login?token={jwt_token}&provider=vk"
    if needs_profile:
        redirect_url += "&complete_profile=1"
    resp = RedirectResponse(url=redirect_url)
    resp.delete_cookie("vk_cv")
    return resp


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

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
        gender=current_user.gender,
        city=current_user.city,
        phone=current_user.phone,
        telegram_username=current_user.telegram_username,
        vk_url=current_user.vk_url,
        email_verified=current_user.email_verified,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )
