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
    "Процессор": "🖥️",
    "Видеокарта": "🎮",
    "Материнская плата": "🔌",
    "Оперативная память": "💾",
    "SSD": "💿",
    "HDD": "💽",
    "Блок питания": "⚡",
    "Корпус": "🖥",
    "Охлаждение": "❄️",
    "Монитор": "🖵",
    "Периферия": "⌨️",
    "Другое": "📦",
}


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
        "format_price": format_price,
    }

    html_content = template.render(**context)

    pdf_buffer = BytesIO()
    HTML(string=html_content, base_url="/").write_pdf(pdf_buffer)
    return pdf_buffer.getvalue()
