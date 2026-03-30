import hashlib
import hmac
import random
import string
from datetime import datetime, timedelta, timezone

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.schemas.auth import TelegramAuthData

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return {}


def generate_short_code_value() -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=6))


def verify_telegram_auth(data: TelegramAuthData, bot_token: str) -> bool:
    """
    Verify Telegram Login Widget data using HMAC-SHA256.
    The secret key is SHA256(bot_token).
    The data-check-string is built from all fields except 'hash',
    sorted alphabetically, joined by newlines as 'key=value'.
    """
    fields = {
        "id": str(data.id),
        "first_name": data.first_name,
        "auth_date": str(data.auth_date),
    }
    if data.last_name:
        fields["last_name"] = data.last_name
    if data.username:
        fields["username"] = data.username
    if data.photo_url:
        fields["photo_url"] = data.photo_url

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, data.hash)


async def get_vk_access_token(code: str, redirect_uri: str, device_id: str = "") -> dict:
    """Exchange VK ID authorization code for access token (VK ID OAuth2)."""
    url = "https://id.vk.com/oauth2/auth"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": settings.VK_CLIENT_ID,
        "client_secret": settings.VK_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "device_id": device_id,
        "state": "",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data)
        return response.json()


async def get_vk_user_info(access_token: str) -> dict:
    """Get user info from VK ID."""
    url = "https://id.vk.com/oauth2/user_info"
    data = {
        "client_id": settings.VK_CLIENT_ID,
        "access_token": access_token,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data)
        response.raise_for_status()
        return response.json()
