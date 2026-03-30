import os
from io import BytesIO

import httpx
from PIL import Image

ICON_DIR = "/app/uploads/store-icons"


async def fetch_favicon(domain: str, slug: str) -> str | None:
    """Fetch favicon for a domain, save to /uploads/store-icons/{slug}.png, return path or None."""
    os.makedirs(ICON_DIR, exist_ok=True)

    sources = [
        f"https://www.google.com/s2/favicons?domain={domain}&sz=64",
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
        f"https://{domain}/favicon.ico",
    ]

    for url in sources:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                content_type = resp.headers.get("content-type", "")
                # Skip HTML error pages
                if "text/html" in content_type:
                    continue
                if len(resp.content) < 100:
                    continue

                # Convert to PNG using Pillow
                img = Image.open(BytesIO(resp.content))
                img = img.convert("RGBA")
                img = img.resize((64, 64), Image.LANCZOS)

                save_path = os.path.join(ICON_DIR, f"{slug}.png")
                img.save(save_path, "PNG")
                return f"/uploads/store-icons/{slug}.png"
        except Exception:
            continue

    return None
