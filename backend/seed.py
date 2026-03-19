"""
Seed script to populate the database with test data.

Usage:
    python seed.py

Creates:
    - 1 superadmin: admin@happypc.ru / admin123
    - 2 workshops: HappyPC Москва, HappyPC Питер
    - 2 masters: master1@happypc.ru / master123, master2@happypc.ru / master123
    - 3 sample builds with realistic Russian PC components
    - Default app settings
"""

import asyncio
import random
import string
import sys

from sqlalchemy import select

sys.path.insert(0, "/app")

from app.database import AsyncSessionLocal, engine
from app.models import Base, AppSettings, Build, BuildItem, User, Workshop
from app.services.auth import hash_password


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
        "description": "Название компании",
    },
    {
        "key": "company_city",
        "value": "Москва",
        "description": "Город компании",
    },
    {
        "key": "company_phone",
        "value": "+7 (495) 000-00-00",
        "description": "Телефон компании",
    },
    {
        "key": "company_email",
        "value": "info@happypc.ru",
        "description": "Email компании",
    },
]

SAMPLE_BUILDS = [
    {
        "title": "Игровая сборка — Средний бюджет",
        "description": "Отличный вариант для современных игр в Full HD. Тихая и производительная система с хорошим запасом на будущее.",
        "labor_percent": 7.0,
        "items": [
            {"category": "Процессор", "name": "AMD Ryzen 5 7600X, OEM", "price": 18500.0, "url": "https://market.yandex.ru/search?text=Ryzen+5+7600X"},
            {"category": "Материнская плата", "name": "ASUS PRIME B650-PLUS-CSM", "price": 12990.0, "url": "https://market.yandex.ru/search?text=ASUS+PRIME+B650"},
            {"category": "Оперативная память", "name": "Kingston Fury Beast DDR5 16GB (2x8GB) 5200MHz", "price": 6800.0, "url": None},
            {"category": "Видеокарта", "name": "GIGABYTE GeForce RTX 4060 GAMING OC 8G", "price": 34500.0, "url": "https://market.yandex.ru/search?text=RTX+4060"},
            {"category": "SSD", "name": "Samsung 980 Pro 1TB NVMe M.2", "price": 7200.0, "url": None},
            {"category": "Корпус", "name": "DeepCool MATREXX 55 V3 Mesh, черный, ATX", "price": 4500.0, "url": None},
            {"category": "Блок питания", "name": "be quiet! Pure Power 12 700W, 80+ Gold, ATX", "price": 8100.0, "url": None},
            {"category": "Охлаждение", "name": "DeepCool AK400 WH, башенный, 120мм", "price": 2700.0, "url": None},
        ],
    },
    {
        "title": "Рабочая станция для дизайнера",
        "description": "Профессиональная станция для работы с Adobe Creative Suite, 3D-рендерингом и видеомонтажом. 32 ГБ ОЗУ, быстрый SSD.",
        "labor_percent": 7.0,
        "labor_price_manual": 5000.0,
        "items": [
            {"category": "Процессор", "name": "Intel Core i7-13700K, BOX", "price": 29900.0, "url": "https://market.yandex.ru/search?text=i7-13700K"},
            {"category": "Материнская плата", "name": "MSI PRO Z790-A WIFI DDR4", "price": 19500.0, "url": None},
            {"category": "Оперативная память", "name": "Corsair Vengeance DDR4 32GB (2x16GB) 3600MHz CL18", "price": 8900.0, "url": None},
            {"category": "Видеокарта", "name": "ASUS ProArt GeForce RTX 4070 12G OC", "price": 59900.0, "url": "https://market.yandex.ru/search?text=RTX+4070"},
            {"category": "SSD", "name": "WD Black SN850X 2TB NVMe M.2 (осн. диск)", "price": 16500.0, "url": None},
            {"category": "HDD", "name": "Seagate BarraCuda 4TB, SATA III (хранилище)", "price": 8200.0, "url": None},
            {"category": "Корпус", "name": "Fractal Design Meshify C White, ATX, Tempered Glass", "price": 9800.0, "url": None},
            {"category": "Блок питания", "name": "Seasonic FOCUS GX-850 850W, 80+ Gold, Fully Modular", "price": 12500.0, "url": None},
            {"category": "Охлаждение", "name": "Noctua NH-D15, Dual Tower, 2x140мм", "price": 8700.0, "url": None},
            {"category": "Монитор", "name": 'LG 27UK850-W, 27", 4K IPS, 60Hz, USB-C', "price": 34900.0, "url": None},
        ],
    },
    {
        "title": "Бюджетный офисный ПК",
        "description": "Экономичный вариант для офисных задач: документы, браузер, таблицы. Тихая работа, низкое энергопотребление.",
        "labor_percent": 10.0,
        "items": [
            {"category": "Процессор", "name": "Intel Core i3-12100, BOX", "price": 8900.0, "url": None},
            {"category": "Материнская плата", "name": "MSI PRO H610M-G DDR4", "price": 6200.0, "url": None},
            {"category": "Оперативная память", "name": "Crucial 16GB (2x8GB) DDR4 3200MHz", "price": 3400.0, "url": None},
            {"category": "SSD", "name": "Kingston A400 480GB SATA", "price": 2800.0, "url": None},
            {"category": "Корпус", "name": "Zalman S2, Micro ATX, черный", "price": 2100.0, "url": None},
            {"category": "Блок питания", "name": "Chieftec 500W, 80+ Bronze", "price": 3200.0, "url": None},
            {"category": "Периферия", "name": "Комплект: клавиатура + мышь Logitech MK235", "price": 1800.0, "url": None},
        ],
    },
]


def make_short_code() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=6))


async def seed():
    print("=== HappyPC Seed Script ===")
    print("Создание таблиц базы данных...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # ---- Workshops ----
        print("Создание мастерских...")

        result = await session.execute(select(Workshop).where(Workshop.name == "HappyPC Москва"))
        workshop_moscow = result.scalar_one_or_none()
        if not workshop_moscow:
            workshop_moscow = Workshop(name="HappyPC Москва", city="Москва")
            session.add(workshop_moscow)
            await session.flush()
            print(f"  ✓ Мастерская: {workshop_moscow.name} (id={workshop_moscow.id})")
        else:
            print(f"  → Мастерская {workshop_moscow.name} уже существует")

        result = await session.execute(select(Workshop).where(Workshop.name == "HappyPC Питер"))
        workshop_spb = result.scalar_one_or_none()
        if not workshop_spb:
            workshop_spb = Workshop(name="HappyPC Питер", city="Санкт-Петербург")
            session.add(workshop_spb)
            await session.flush()
            print(f"  ✓ Мастерская: {workshop_spb.name} (id={workshop_spb.id})")
        else:
            print(f"  → Мастерская {workshop_spb.name} уже существует")

        # ---- Superadmin ----
        print("Создание суперадминистратора...")
        result = await session.execute(select(User).where(User.email == "admin@happypc.ru"))
        superadmin = result.scalar_one_or_none()
        if not superadmin:
            superadmin = User(
                email="admin@happypc.ru",
                password_hash=hash_password("admin123"),
                name="Главный Администратор",
                role="superadmin",
                workshop_id=workshop_moscow.id,
                is_active=True,
            )
            session.add(superadmin)
            await session.flush()
            print(f"  ✓ Суперадмин: admin@happypc.ru / admin123 (id={superadmin.id})")
        else:
            print(f"  → Суперадмин admin@happypc.ru уже существует")

        # ---- Masters ----
        print("Создание мастеров...")
        masters_data = [
            {
                "email": "master1@happypc.ru",
                "password": "master123",
                "name": "Алексей Смирнов",
                "workshop": workshop_moscow,
            },
            {
                "email": "master2@happypc.ru",
                "password": "master123",
                "name": "Дмитрий Козлов",
                "workshop": workshop_spb,
            },
        ]

        masters = []
        for m_data in masters_data:
            result = await session.execute(select(User).where(User.email == m_data["email"]))
            master = result.scalar_one_or_none()
            if not master:
                master = User(
                    email=m_data["email"],
                    password_hash=hash_password(m_data["password"]),
                    name=m_data["name"],
                    role="master",
                    workshop_id=m_data["workshop"].id,
                    is_active=True,
                )
                session.add(master)
                await session.flush()
                print(f"  ✓ Мастер: {m_data['email']} / {m_data['password']} — {m_data['name']}")
            else:
                print(f"  → Мастер {m_data['email']} уже существует")
            masters.append(master)

        # ---- Sample Builds ----
        print("Создание тестовых сборок...")
        master_for_builds = [masters[0], masters[0], masters[1]]
        workshop_for_builds = [workshop_moscow, workshop_moscow, workshop_spb]

        for i, (build_data, master, workshop) in enumerate(
            zip(SAMPLE_BUILDS, master_for_builds, workshop_for_builds)
        ):
            result = await session.execute(
                select(Build).where(Build.title == build_data["title"])
            )
            existing_build = result.scalar_one_or_none()
            if existing_build:
                print(f"  → Сборка '{build_data['title']}' уже существует")
                continue

            # Generate unique short code
            short_code = None
            for _ in range(20):
                candidate = make_short_code()
                check = await session.execute(select(Build).where(Build.short_code == candidate))
                if not check.scalar_one_or_none():
                    short_code = candidate
                    break

            if not short_code:
                print(f"  ✗ Не удалось создать уникальный код для сборки {i+1}")
                continue

            build = Build(
                short_code=short_code,
                title=build_data["title"],
                description=build_data.get("description"),
                author_id=master.id,
                workshop_id=workshop.id,
                is_public=True,
                labor_percent=build_data["labor_percent"],
                labor_price_manual=build_data.get("labor_price_manual"),
            )
            session.add(build)
            await session.flush()

            for j, item_data in enumerate(build_data["items"]):
                item = BuildItem(
                    build_id=build.id,
                    category=item_data["category"],
                    name=item_data["name"],
                    url=item_data.get("url"),
                    price=item_data["price"],
                    sort_order=j,
                )
                session.add(item)

            await session.flush()
            total = sum(it["price"] for it in build_data["items"])
            print(f"  ✓ Сборка: '{build_data['title']}' (код: {short_code}, итого: {total:,.0f} ₽, автор: {master.name})")

        # ---- Default Settings ----
        print("Создание настроек по умолчанию...")
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
                print(f"  ✓ Настройка: {setting_data['key']} = {setting_data['value']!r}")
            else:
                print(f"  → Настройка '{setting_data['key']}' уже существует")

        await session.commit()

    print()
    print("=== Сид завершён успешно! ===")
    print()
    print("Учётные данные для входа:")
    print("  Суперадмин: admin@happypc.ru  / admin123")
    print("  Мастер 1:   master1@happypc.ru / master123  (Москва)")
    print("  Мастер 2:   master2@happypc.ru / master123  (Питер)")


if __name__ == "__main__":
    asyncio.run(seed())
