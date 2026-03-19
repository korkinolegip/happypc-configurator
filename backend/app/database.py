import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Use SSL for external (cloud) databases; local docker uses plain connection
_is_external_db = not settings.DATABASE_URL.startswith("postgresql+asyncpg://postgres@") and \
                  ("neon.tech" in settings.DATABASE_URL or
                   "render.com" in settings.DATABASE_URL or
                   "amazonaws.com" in settings.DATABASE_URL or
                   "onrender.com" in settings.DATABASE_URL)

_connect_args = {"ssl": ssl.create_default_context()} if _is_external_db else {}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
