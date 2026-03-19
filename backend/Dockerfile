FROM python:3.11-slim-bookworm

# WeasyPrint dependencies (for PDF generation)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
    libcairo2 libffi-dev \
    libgdk-pixbuf-2.0-0 libgdk-pixbuf-xlib-2.0-0 \
    fonts-liberation fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser for anti-bot scraping (Avito, Ozon, etc.)
RUN playwright install-deps chromium && playwright install chromium

COPY . .

RUN mkdir -p /app/uploads/avatars /app/static

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"]
