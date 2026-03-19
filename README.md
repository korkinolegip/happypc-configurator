# HappyPC Конфигуратор сборок ПК

Конфигуратор сборок ПК с брендингом HappyPC. Позволяет мастерам создавать, делиться и экспортировать в PDF конфигурации ПК с расчётом стоимости работ.

## Стек

- **Backend:** FastAPI (Python) + PostgreSQL + SQLAlchemy
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **PDF:** WeasyPrint + Jinja2
- **Деплой:** Docker + Railway.app / собственный сервер

---

## Быстрый старт (локально)

### Требования
- Docker + Docker Compose
- Git

### 1. Клонировать и настроить

```bash
git clone <repo-url>
cd happypc-configurator
cp .env.example .env
# Отредактировать .env при необходимости
```

### 2. Запустить

```bash
docker-compose up --build
```

### 3. Загрузить тестовые данные

```bash
docker-compose exec backend python seed.py
```

### 4. Открыть

- Сайт: http://localhost:3000
- API docs: http://localhost:8000/docs

### Тестовые аккаунты

| Email | Пароль | Роль |
|-------|--------|------|
| admin@happypc.ru | admin123 | superadmin |
| master1@happypc.ru | master123 | master (Москва) |
| master2@happypc.ru | master123 | master (Питер) |

> ⚠️ **Обязательно смените пароли перед деплоем в продакшн!**

---

## Деплой на Railway.app (бесплатно)

### 1. Создать аккаунт Railway
Зарегистрироваться на [railway.app](https://railway.app)

### 2. Создать проект

```bash
# Установить Railway CLI
npm install -g @railway/cli

# Войти
railway login

# Создать проект
railway init
```

### 3. Добавить PostgreSQL

В Railway Dashboard → "Add Service" → "Database" → "PostgreSQL"

### 4. Деплой бекенда

```bash
cd backend
railway up
```

Переменные окружения (в Railway Dashboard → Variables):
```
DATABASE_URL=<автоматически из Railway PostgreSQL>
SECRET_KEY=<случайная строка, минимум 32 символа>
FRONTEND_URL=https://<ваш-домен>
```

### 5. Деплой фронтенда

Вариант А — Vercel (рекомендуется):
```bash
cd frontend
npm run build
# Задеплоить папку dist на Vercel
```
Установить переменную: `VITE_API_URL=https://<url-бекенда-на-railway>`

Вариант Б — Railway (второй сервис):
```bash
cd frontend
railway up
```

### 6. Первый запуск

После деплоя выполнить seed:
```bash
railway run python seed.py
```

---

## Деплой на собственный сервер

### Требования
- Ubuntu 20.04+
- Docker + Docker Compose
- Домен (например, config.happypc.ru)

### Шаги

```bash
# 1. Клонировать репозиторий
git clone <repo-url> /opt/happypc
cd /opt/happypc

# 2. Настроить переменные
cp .env.example .env
nano .env  # заполнить все значения

# 3. Запустить
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Загрузить тестовые данные
docker-compose -f docker-compose.prod.yml exec backend python seed.py

# 5. SSL (опционально, через Certbot)
docker run --rm -v ./certbot_data:/etc/letsencrypt \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d config.happypc.ru
```

### Обновление

```bash
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Авторизация через Telegram

1. Создать бота в [@BotFather](https://t.me/BotFather): `/newbot`
2. Включить Login Widget: `/setdomain` → указать домен сайта
3. В `.env` указать:
   ```
   TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
   TELEGRAM_BOT_NAME=YourBotName
   ```
4. В Настройках админки ввести имя бота

---

## Авторизация через VK

1. Создать приложение на [vk.com/dev](https://vk.com/dev)
   - Тип: Web
   - Redirect URI: `https://ваш-домен.ru/auth/vk/callback`
2. В `.env` указать:
   ```
   VK_CLIENT_ID=12345678
   VK_CLIENT_SECRET=abc123...
   ```

---

## Структура проекта

```
happypc-configurator/
├── backend/               # FastAPI приложение
│   ├── app/
│   │   ├── api/           # Роуты API
│   │   ├── models/        # SQLAlchemy модели
│   │   ├── schemas/       # Pydantic схемы
│   │   ├── services/      # Бизнес-логика
│   │   └── templates/     # Jinja2 шаблоны (PDF)
│   ├── alembic/           # Миграции БД
│   ├── Dockerfile
│   ├── requirements.txt
│   └── seed.py            # Тестовые данные
├── frontend/              # React приложение
│   ├── src/
│   │   ├── api/           # HTTP клиент
│   │   ├── components/    # UI компоненты
│   │   ├── pages/         # Страницы
│   │   └── context/       # Auth контекст
│   └── Dockerfile
├── design/                # Логотипы HappyPC
├── docker-compose.yml     # Локальная разработка
├── docker-compose.prod.yml # Продакшн
└── nginx.prod.conf        # Nginx конфиг
```

---

## API Документация

После запуска доступна по адресу: http://localhost:8000/docs (Swagger UI)

---

## Роли пользователей

| Роль | Права |
|------|-------|
| `superadmin` | Полный доступ, управление системой |
| `admin` | Управление пользователями своей мастерской |
| `master` | Создание и управление сборками |
| `user` | Просмотр, создание своих сборок |

---

## Категории комплектующих

Процессор, Видеокарта, Материнская плата, Оперативная память, SSD, HDD, Блок питания, Корпус, Охлаждение, Монитор, Периферия, Другое
