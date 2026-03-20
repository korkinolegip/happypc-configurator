import os
from datetime import datetime
from io import BytesIO

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from app.services.builds import calculate_totals

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
LOGO_PATH = "/app/static/logo-white.png"


def format_price(value: float) -> str:
    """Format a price value with thousands separator and rouble sign."""
    return f"{value:,.0f}".replace(",", " ") + " ₽"


CATEGORY_ICONS = {
    "Процессор": "CPU",
    "Видеокарта": "GPU",
    "Материнская плата": "MB",
    "Оперативная память": "RAM",
    "SSD": "SSD",
    "HDD": "HDD",
    "Блок питания": "PSU",
    "Корпус": "CASE",
    "Охлаждение": "COOL",
    "Вентиляторы": "FAN",
    "Монитор": "MON",
    "Клавиатура": "KB",
    "Мышь": "MOUSE",
    "Наушники": "AUDIO",
    "Колонки": "SPK",
    "Операционная система": "OS",
    "Периферия": "PER",
    "Другое": "OTHER",
}

STORE_DETECT = {
    "wildberries.ru": ("WB", "#CB11AB"),
    "wb.ru": ("WB", "#CB11AB"),
    "dns-shop.ru": ("DNS", "#F62A00"),
    "ozon.ru": ("Ozon", "#005BFF"),
    "market.yandex.ru": ("YM", "#FFCC00"),
    "ya.cc": ("YM", "#FFCC00"),
    "avito.ru": ("Avito", "#00AAFF"),
    "megamarket.ru": ("MM", "#FF5C00"),
    "citilink.ru": ("CL", "#FF8C00"),
    "mvideo.ru": ("MV", "#FF0000"),
    "eldorado.ru": ("EL", "#FFD700"),
}


def detect_store(url: str | None) -> tuple[str, str] | None:
    if not url:
        return None
    u = url.lower()
    for domain, info in STORE_DETECT.items():
        if domain in u:
            return info
    return None


async def generate_build_pdf(build, author_name: str, workshop_name: str | None) -> bytes:
    """
    Render the PDF template with build data and convert to PDF bytes using WeasyPrint.
    """
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["format_price"] = format_price

    template = env.get_template("pdf.html")

    totals = calculate_totals(build.items, build.labor_percent, build.labor_price_manual)

    logo_exists = os.path.isfile(LOGO_PATH)

    context = {
        "title": build.title,
        "description": build.description,
        "short_code": build.short_code,
        "author_name": author_name,
        "workshop_name": workshop_name,
        "created_at": build.created_at,
        "generated_at": datetime.now(),
        "items": build.items,
        "hardware_total": totals["hardware_total"],
        "labor_cost": totals["labor_cost"],
        "total_with_labor": totals["total_with_labor"],
        "total_turnkey": totals["total_turnkey"],
        "labor_percent": build.labor_percent,
        "labor_price_manual": build.labor_price_manual,
        "logo_path": LOGO_PATH if logo_exists else None,
        "category_icons": CATEGORY_ICONS,
        "detect_store": detect_store,
        "format_price": format_price,
        "tags": build.tags or [],
        "case_color": "белый" if build.tags and "белый" in build.tags else ("чёрный" if build.tags and "черный" in (build.tags or []) else None),
    }

    html_content = template.render(**context)

    pdf_buffer = BytesIO()
    HTML(string=html_content, base_url="/").write_pdf(pdf_buffer)
    return pdf_buffer.getvalue()
