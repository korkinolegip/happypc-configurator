FROM python:3.11-slim

# Install WeasyPrint + Chromium (for Playwright anti-bot scraping)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
    libcairo2 libffi-dev \
    libgdk-pixbuf-2.0-0 libgdk-pixbuf-xlib-2.0-0 \
    fonts-liberation fonts-dejavu \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and use system Chromium (no separate ~300MB download)
RUN pip install --no-cache-dir playwright==1.43.0
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY . .

RUN mkdir -p /app/uploads/avatars /app/static

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
