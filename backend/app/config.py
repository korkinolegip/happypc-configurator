from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/happypc"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        if not isinstance(v, str):
            return v
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        import re
        v = re.sub(r"[&?]channel_binding=[^&]*", "", v)
        v = re.sub(r"[&?]sslmode=[^&]*", "", v)
        v = re.sub(r"\?$", "", v)
        return v
    SECRET_KEY: str = "changeme-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_NAME: str = ""

    VK_CLIENT_ID: str = ""
    VK_CLIENT_SECRET: str = ""
    VK_REDIRECT_URI: str = ""

    FRONTEND_URL: str = "https://happypc.ipkorkin.ru"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "HappyPC"

    # Optional HTTP proxy for Russian store scraping
    SCRAPER_PROXY: str = ""

    # ZenRows API key for scraping protected stores
    ZENROWS_API_KEY: str = ""

    # Apify API token for Yandex Market scraping
    APIFY_TOKEN: str = ""

    # iMac scraper URL (for stores that need home IP)
    IMAC_SCRAPER_URL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
