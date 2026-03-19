"""
URL parser service — scrapes product name and price from store pages.

Strategy (in order):
1. curl_cffi — mimics real Chrome TLS fingerprint, bypasses Cloudflare & most anti-bot
2. httpx fallback — standard HTTP client (if curl_cffi not available)
3. Playwright fallback — full JS rendering (for heavy SPA pages like Ozon)

Store-specific parsers:
- Wildberries: public card API (fastest, no bot check)
- Ozon: curl_cffi + JSON-LD / og tags
- DNS-shop: curl_cffi + og tags (Cloudflare bypass)
- Avito: curl_cffi + specific title extraction
- Yandex Market: og tags
- MegaMarket, AliExpress, Citilink, M.Video, Eldorado: generic og tags
"""
import json
import re
from typing import Optional
import httpx

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

BOT_CHECK_INDICATORS = [
    "Почти готово",
    "Just a moment",
    "Checking your browser",
    "DDoS-Guard",
    "Are you a robot",
    "Antibot Challenge",
    "captcha",
    "CAPTCHA",
    "Access denied",
    "HTTP 403",
    "403 Forbidden",
    "Доступ ограничен",
    "Forbidden",
    "Нет доступа",
    "Error 403",
    "Rate limit",
    "enable JavaScript",
    "Enable JavaScript",
    # Homepage redirects (store returned homepage instead of product page)
    "Интернет-магазин Wildberries",
    "Авито — Объявления на сайте Авито",
    "Авито — Купить и продать",
    "OZON — интернет-магазин",
    "DNS — интернет-магазин",
    "Яндекс Маркет — онлайн-гипермаркет",
]


def _detect_store(url: str) -> str:
    u = url.lower()
    if "wildberries.ru" in u or "wb.ru" in u:
        return "wildberries"
    if "dns-shop.ru" in u:
        return "dns"
    if "ozon.ru" in u:
        return "ozon"
    if "megamarket.ru" in u:
        return "megamarket"
    if "aliexpress.ru" in u or "aliexpress.com" in u:
        return "aliexpress"
    if "avito.ru" in u:
        return "avito"
    if "citilink.ru" in u:
        return "citilink"
    if "mvideo.ru" in u:
        return "mvideo"
    if "eldorado.ru" in u:
        return "eldorado"
    if "market.yandex.ru" in u or "yandex.ru/market" in u:
        return "yandex_market"
    return "unknown"


def _is_bot_check(html: str) -> bool:
    snippet = html[:4000]
    return any(ind in snippet for ind in BOT_CHECK_INDICATORS)


def _extract_og(html: str, tag: str) -> Optional[str]:
    # property="og:X"  or  name="X"  — both attribute orderings
    for pattern in [
        rf'<meta[^>]+(?:property|name)=["\'](?:og:)?{re.escape(tag)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:)?{re.escape(tag)}["\']',
    ]:
        m = re.search(pattern, html, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _extract_title_tag(html: str) -> Optional[str]:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _clean_price(raw: str) -> Optional[float]:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.,]", "", raw.replace("\xa0", "").replace("\u2009", "").replace(" ", ""))
    cleaned = cleaned.replace(",", ".")
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        val = float(cleaned)
        return val if 1 <= val <= 10_000_000 else None
    except ValueError:
        return None


def _extract_json_ld_price(html: str) -> Optional[float]:
    """Extract price from JSON-LD structured data."""
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(m.group(1))
            # Can be a list or dict
            items = data if isinstance(data, list) else [data]
            for item in items:
                # Product schema
                if item.get("@type") in ("Product", "Offer"):
                    offers = item.get("offers") or item
                    if isinstance(offers, dict):
                        price = offers.get("price") or offers.get("lowPrice")
                        if price:
                            return _clean_price(str(price))
                    elif isinstance(offers, list) and offers:
                        price = offers[0].get("price") or offers[0].get("lowPrice")
                        if price:
                            return _clean_price(str(price))
                    name = item.get("name")
                    if name:
                        return None  # name extracted separately
        except Exception:
            continue
    return None


def _extract_json_ld_name(html: str) -> Optional[str]:
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(m.group(1))
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Product":
                    name = item.get("name")
                    if name:
                        return str(name).strip()
        except Exception:
            continue
    return None


def _parse_html(html: str, store: str, site_suffix: str = "") -> dict:
    # Try JSON-LD first (most reliable)
    name = _extract_json_ld_name(html)
    price = _extract_json_ld_price(html)

    # og:title fallback
    if not name:
        name = _extract_og(html, "title")

    # <title> fallback
    if not name:
        name = _extract_title_tag(html)
        if name and site_suffix:
            name = re.sub(rf"\s*[|—–\-]\s*{re.escape(site_suffix)}.*$", "", name, flags=re.IGNORECASE).strip()

    # og:price fallbacks
    if not price:
        for prop in ("price:amount", "price", "product:price:amount"):
            raw = _extract_og(html, prop)
            if raw:
                price = _clean_price(raw)
                if price:
                    break

    # JSON price inline fallback
    if not price:
        m = re.search(r'"price"\s*:\s*"?([\d\s]+(?:[.,]\d+)?)"?', html)
        if m:
            price = _clean_price(m.group(1))

    return {"name": name, "price": price, "store": store}


# ─── curl_cffi fetch (Chrome TLS fingerprint) ────────────────────────────────

async def _cffi_fetch(url: str, referer: str = "") -> Optional[str]:
    """Use curl_cffi to mimic real Chrome — bypasses Cloudflare & TLS fingerprinting."""
    try:
        from curl_cffi.requests import AsyncSession
        headers = {**BROWSER_HEADERS}
        if referer:
            headers["Referer"] = referer
        async with AsyncSession() as session:
            resp = await session.get(
                url,
                headers=headers,
                impersonate="chrome124",
                timeout=15,
                allow_redirects=True,
            )
            if resp.status_code == 200:
                html = resp.text
                if not _is_bot_check(html[:3000]):
                    return html
    except ImportError:
        pass  # curl_cffi not installed, fall through
    except Exception:
        pass
    return None


async def _httpx_fetch(url: str, referer: str = "") -> Optional[str]:
    """Standard httpx fetch as fallback."""
    headers = {**BROWSER_HEADERS}
    if referer:
        headers["Referer"] = referer
    try:
        async with httpx.AsyncClient(timeout=12, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and not _is_bot_check(resp.text[:3000]):
                return resp.text
    except Exception:
        pass
    return None


async def _playwright_fetch(url: str) -> Optional[str]:
    """Full JS render via Playwright — last resort for SPA pages."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1366,768",
                ],
                executable_path="/usr/bin/chromium",
            )
            context = await browser.new_context(
                user_agent=BROWSER_HEADERS["User-Agent"],
                locale="ru-RU",
                viewport={"width": 1366, "height": 768},
                extra_http_headers={"Accept-Language": "ru-RU,ru;q=0.9"},
            )
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
            html = await page.content()
            await browser.close()
            if _is_bot_check(html[:3000]):
                return None
            return html
    except Exception:
        return None


async def _fetch_url(url: str, referer: str = "") -> Optional[str]:
    """Try curl_cffi → httpx → Playwright."""
    html = await _cffi_fetch(url, referer)
    if html:
        return html
    html = await _httpx_fetch(url, referer)
    if html:
        return html
    return await _playwright_fetch(url)


# ─── Store-specific parsers ───────────────────────────────────────────────────

def _wb_basket(nm: int) -> str:
    """Calculate WB basket server number from product nm."""
    vol = nm // 100000
    if vol <= 143: return "01"
    if vol <= 287: return "02"
    if vol <= 431: return "03"
    if vol <= 719: return "04"
    if vol <= 1007: return "05"
    if vol <= 1061: return "06"
    if vol <= 1115: return "07"
    if vol <= 1169: return "08"
    if vol <= 1313: return "09"
    if vol <= 1601: return "10"
    if vol <= 1655: return "11"
    if vol <= 1919: return "12"
    if vol <= 2045: return "13"
    if vol <= 2189: return "14"
    if vol <= 2405: return "15"
    if vol <= 2621: return "16"
    if vol <= 2837: return "17"
    if vol <= 3053: return "18"
    if vol <= 3269: return "19"
    if vol <= 3485: return "20"
    return "21"


async def _fetch_wildberries(url: str) -> dict:
    """
    WB name: basket CDN (works without Russian IP).
    WB price: card.wb.ru API (works from Russian IP in production).
    """
    m = re.search(r"/catalog/(\d+)", url)
    if not m:
        return {}
    nm_str = m.group(1)
    nm = int(nm_str)
    vol = nm // 100000
    part = nm // 1000
    basket = _wb_basket(nm)

    name = None
    price = None

    # 1) Get name from basket CDN (works globally)
    cdn_url = f"https://basket-{basket}.wbbasket.ru/vol{vol}/part{part}/{nm}/info/ru/card.json"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(cdn_url)
            if resp.status_code == 200:
                data = resp.json()
                imt_name = data.get("imt_name", "")
                subj = data.get("subj_name", "")
                brand = data.get("selling", {}).get("brand_name", "")
                if imt_name:
                    name = f"{brand} {imt_name}".strip() if brand else imt_name
    except Exception:
        pass

    # 2) Get price from card API (works from Russian IP)
    for api_ver in ["v2", "v1"]:
        for dest in ["-1257786", "-1258185", "12358062", ""]:
            params = f"appType=1&curr=rub&nm={nm_str}"
            if dest:
                params += f"&dest={dest}"
            api_url = f"https://card.wb.ru/cards/{api_ver}/detail?{params}"
            try:
                async with httpx.AsyncClient(timeout=8, headers=BROWSER_HEADERS) as client:
                    resp = await client.get(api_url)
                    if resp.status_code == 200 and resp.text:
                        products = resp.json().get("data", {}).get("products", [])
                        if products:
                            p = products[0]
                            if not name:
                                brand = p.get("brand", "")
                                pname = p.get("name", "")
                                name = f"{brand} {pname}".strip() if brand else pname
                            sale_price = p.get("salePriceU")
                            price = round(sale_price / 100) if sale_price else None
                            break
            except Exception:
                continue
        if price:
            break

    if name:
        return {"name": name, "price": price, "store": "wildberries"}

    # 3) Fallback: page scrape
    html = await _fetch_url(url, referer="https://www.wildberries.ru/")
    if html:
        result = _parse_html(html, "wildberries", "Wildberries")
        name = result.get("name", "")
        if name and any(s in name for s in ["Интернет-магазин", "широкий ассортимент", "Wildberries"]):
            return {"store": "wildberries"}
        return result
    return {}


async def _fetch_ozon(url: str) -> dict:
    """Ozon: try curl_cffi first, then Playwright."""
    # Try curl_cffi (best for Ozon SSR)
    html = await _cffi_fetch(url, referer="https://www.ozon.ru/")
    if html:
        result = _parse_html(html, "ozon", "OZON")
        if result.get("name"):
            return result
    # Try Playwright (full JS render)
    html = await _playwright_fetch(url)
    if html:
        result = _parse_html(html, "ozon", "OZON")
        if result.get("name"):
            return result
    return {"store": "ozon"}


async def _fetch_dns(url: str) -> dict:
    """DNS-shop: curl_cffi bypasses Cloudflare on real RU IP."""
    html = await _fetch_url(url, referer="https://www.dns-shop.ru/")
    if not html:
        return {"store": "dns"}
    result = _parse_html(html, "dns", "DNS")
    if result.get("name"):
        # Remove DNS suffix from title
        result["name"] = re.sub(r"\s*[—–-]\s*DNS.*$", "", result["name"]).strip()
        result["name"] = re.sub(r"\s*[—–-]\s*купить.*$", "", result["name"], flags=re.IGNORECASE).strip()
    return result


async def _fetch_avito(url: str) -> dict:
    """
    Avito: the og:title contains '[product] — [city] — Авито'.
    Extract just the product name.
    """
    html = await _fetch_url(url, referer="https://www.avito.ru/")
    if not html:
        return {"store": "avito"}

    # Try og:title first
    og = _extract_og(html, "title")
    if og:
        # Remove suffix: " — Объявление на Авито" / " | Авито" / " — Авито" etc.
        name = re.sub(r"\s*[—–|]\s*(?:Объявление\s+на\s+)?Авито.*$", "", og, flags=re.IGNORECASE).strip()
        # Remove city: "Название — Город — Авито" → strip last city part too
        name = re.sub(r"\s*—\s*[А-ЯЁ][а-яё\s\-]+$", "", name).strip()
        if name and name.lower() not in ("авито", "avito"):
            price = None
            for prop in ("price:amount", "price"):
                raw = _extract_og(html, prop)
                if raw:
                    price = _clean_price(raw)
                    if price:
                        break
            if not price:
                price = _extract_json_ld_price(html)
            return {"name": name, "price": price, "store": "avito"}

    # Try JSON-LD
    name = _extract_json_ld_name(html)
    price = _extract_json_ld_price(html)
    if name:
        return {"name": name, "price": price, "store": "avito"}

    return {"store": "avito"}


async def _fetch_yandex_market(url: str) -> dict:
    """Yandex Market: og tags work well when accessed with RU IP."""
    html = await _fetch_url(url, referer="https://market.yandex.ru/")
    if not html:
        return {"store": "yandex_market"}
    result = _parse_html(html, "yandex_market", "Яндекс Маркет")
    if result.get("name"):
        # Strip Yandex Market suffix
        result["name"] = re.sub(r"\s*[—–|]\s*(?:Яндекс\s+Маркет|Yandex\s+Market).*$", "", result["name"], flags=re.IGNORECASE).strip()
        result["name"] = re.sub(r"\s*[—–|]\s*купить.*$", "", result["name"], flags=re.IGNORECASE).strip()
    return result


async def _fetch_generic(url: str, store: str) -> dict:
    html = await _fetch_url(url)
    if not html:
        return {"store": store if store != "unknown" else None}
    result = _parse_html(html, store)
    # Clean up common suffixes
    if result.get("name"):
        for suffix in ["Citilink", "М.Видео", "МегаМаркет", "Эльдорадо", "AliExpress"]:
            result["name"] = re.sub(rf"\s*[—–|]\s*{re.escape(suffix)}.*$", "", result["name"], flags=re.IGNORECASE).strip()
    return result


# ─── Public entry point ───────────────────────────────────────────────────────

async def parse_product_url(url: str) -> dict:
    """
    Parse a product URL and return {name, price, store}.
    Always returns at least {store} for the badge.
    Returns {} on complete failure.
    """
    store = _detect_store(url)
    base = {"store": store if store != "unknown" else None}

    try:
        if store == "wildberries":
            result = await _fetch_wildberries(url)
        elif store == "ozon":
            result = await _fetch_ozon(url)
        elif store == "dns":
            result = await _fetch_dns(url)
        elif store == "avito":
            result = await _fetch_avito(url)
        elif store == "yandex_market":
            result = await _fetch_yandex_market(url)
        else:
            result = await _fetch_generic(url, store)

        if result.get("name"):
            result["name"] = result["name"][:200].strip()

        # Ensure store is set
        if not result.get("store") and base.get("store"):
            result["store"] = base["store"]

        return result if result else base

    except Exception:
        return base
