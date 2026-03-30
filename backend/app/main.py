import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api import auth, builds, public, profile, admin, social, permissions
from app.database import engine
from app import models
from app.database import AsyncSessionLocal
from app.models.settings import AppSettings
from app.models.user import User, Workshop
from app.models.city import City, RUSSIAN_CITIES
from app.models.store import Store

app = FastAPI(
    title="HappyPC Configurator",
    description="API для конфигуратора компьютерных сборок HappyPC",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static and upload directories (create them if missing)
os.makedirs("/app/static", exist_ok=True)
os.makedirs("/app/uploads/avatars", exist_ok=True)
os.makedirs("/app/uploads/store-icons", exist_ok=True)
os.makedirs("/app/uploads/bugs", exist_ok=True)

app.mount("/static", StaticFiles(directory="/app/static"), name="static")
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(builds.router, prefix="/api/builds", tags=["builds"])
app.include_router(public.router, prefix="/api/public", tags=["public"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(social.router, prefix="/api/social", tags=["social"])
app.include_router(permissions.router, prefix="/api/permissions", tags=["permissions"])

from app.api import bug_reports
app.include_router(bug_reports.router, prefix="/api/bugs", tags=["bugs"])


DEFAULT_SETTINGS = [
    {
        "key": "registration_enabled",
        "value": "false",
        "description": "Разрешить публичную регистрацию новых пользователей",
    },
    {
        "key": "public_feed_enabled",
        "value": "true",
        "description": "Показывать публичную ленту сборок",
    },
    {
        "key": "default_labor_percent",
        "value": "7",
        "description": "Процент стоимости работы по умолчанию",
    },
    {
        "key": "company_name",
        "value": "HappyPC",
        "description": "Название компании для отображения в интерфейсе",
    },
    {
        "key": "company_city",
        "value": "Москва",
        "description": "Город компании",
    },
    {
        "key": "company_phone",
        "value": "",
        "description": "Телефон компании",
    },
    {
        "key": "company_email",
        "value": "",
        "description": "Email компании",
    },
    {
        "key": "pdf_footer_text",
        "value": "HappyPC — профессиональная сборка компьютеров",
        "description": "Текст в подвале PDF-документа",
    },
    {
        "key": "smtp_host",
        "value": "smtp.yandex.ru",
        "description": "SMTP сервер для отправки почты",
    },
    {
        "key": "smtp_port",
        "value": "465",
        "description": "Порт SMTP сервера",
    },
    {
        "key": "smtp_user",
        "value": "korkin.oleg@ya.ru",
        "description": "Логин SMTP сервера",
    },
    {
        "key": "smtp_password",
        "value": "gdypukhjtpciuyna",
        "description": "Пароль SMTP сервера",
    },
    {
        "key": "smtp_from_email",
        "value": "korkin.oleg@ya.ru",
        "description": "Email отправителя",
    },
    {
        "key": "smtp_from_name",
        "value": "HappyPC",
        "description": "Имя отправителя",
    },
]


async def init_superadmin():
    """Create initial superadmin and workshop if no users exist."""
    from app.services.auth import hash_password
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(User))
            if result.scalars().first() is not None:
                return  # users already exist

            workshop = Workshop(name="HappyPC", city="")
            session.add(workshop)
            await session.flush()

            admin_user = User(
                email="admin@happypc.ru",
                password_hash=hash_password("admin123"),
                name="Администратор",
                role="superadmin",
                workshop_id=workshop.id,
                is_active=True,
            )
            session.add(admin_user)
            await session.commit()
            print("INFO: Created initial superadmin: admin@happypc.ru / admin123")
        except Exception as e:
            await session.rollback()
            print(f"Warning: Could not create superadmin: {e}")


async def init_default_settings():
    """Create default app_settings rows if they do not exist."""
    async with AsyncSessionLocal() as session:
        try:
            for setting_data in DEFAULT_SETTINGS:
                result = await session.execute(
                    select(AppSettings).where(AppSettings.key == setting_data["key"])
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    setting = AppSettings(
                        key=setting_data["key"],
                        value=setting_data["value"],
                        description=setting_data["description"],
                    )
                    session.add(setting)
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Warning: Could not initialize default settings: {e}")


async def init_cities():
    """Seed cities table with Russian cities if empty."""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(City).limit(1))
            if result.scalar_one_or_none() is not None:
                return  # already seeded
            for name, code in RUSSIAN_CITIES:
                session.add(City(name=name, code=code))
            await session.commit()
            print(f"INFO: Seeded {len(RUSSIAN_CITIES)} cities")
        except Exception as e:
            await session.rollback()
            print(f"Warning: Could not seed cities: {e}")


DEFAULT_STORES = [
    {
        "slug": "wildberries",
        "name": "Wildberries",
        "short_label": "WB",
        "color": "#CB11AB",
        "url_patterns": ["wildberries.ru", "wb.ru"],
    },
    {
        "slug": "dns",
        "name": "DNS",
        "short_label": "DNS",
        "color": "#F62A00",
        "url_patterns": ["dns-shop.ru"],
    },
    {
        "slug": "ozon",
        "name": "Ozon",
        "short_label": "Ozon",
        "color": "#005BFF",
        "url_patterns": ["ozon.ru"],
    },
    {
        "slug": "yandex",
        "name": "Яндекс Маркет",
        "short_label": "YM",
        "color": "#FFCC00",
        "url_patterns": ["market.yandex.ru", "ya.cc"],
    },
    {
        "slug": "megamarket",
        "name": "МегаМаркет",
        "short_label": "MM",
        "color": "#FF5C00",
        "url_patterns": ["megamarket.ru"],
    },
    {
        "slug": "aliexpress",
        "name": "AliExpress",
        "short_label": "Ali",
        "color": "#FF6A00",
        "url_patterns": ["aliexpress.ru", "aliexpress.com"],
    },
    {
        "slug": "avito",
        "name": "Авито",
        "short_label": "Avito",
        "color": "#00AAFF",
        "url_patterns": ["avito.ru"],
    },
    {
        "slug": "citilink",
        "name": "Ситилинк",
        "short_label": "CL",
        "color": "#FF8C00",
        "url_patterns": ["citilink.ru"],
    },
    {
        "slug": "mvideo",
        "name": "М.Видео",
        "short_label": "MV",
        "color": "#FF0000",
        "url_patterns": ["mvideo.ru"],
    },
    {
        "slug": "eldorado",
        "name": "Эльдорадо",
        "short_label": "EL",
        "color": "#FFD700",
        "url_patterns": ["eldorado.ru"],
    },
    {
        "slug": "onlinetrade",
        "name": "ОнлайнТрейд",
        "short_label": "OT",
        "color": "#00A046",
        "url_patterns": ["onlinetrade.ru"],
    },
]


async def init_stores():
    """Seed stores table with default stores if empty."""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Store).limit(1))
            if result.scalar_one_or_none() is not None:
                return  # already seeded
            for i, store_data in enumerate(DEFAULT_STORES):
                session.add(Store(
                    slug=store_data["slug"],
                    name=store_data["name"],
                    short_label=store_data["short_label"],
                    color=store_data["color"],
                    url_patterns=store_data["url_patterns"],
                    position=i,
                ))
            await session.commit()
            print(f"INFO: Seeded {len(DEFAULT_STORES)} stores")
        except Exception as e:
            await session.rollback()
            print(f"Warning: Could not seed stores: {e}")


@app.on_event("startup")
async def startup():
    """Initialize database tables and default settings on application startup."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.create_all)
        await init_default_settings()
        await init_superadmin()
        await init_cities()
        await init_stores()
    except Exception as e:
        print(f"WARNING: startup DB init failed: {e}")
        print("App will still start — DB may be unavailable temporarily.")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "HappyPC Configurator API"}
