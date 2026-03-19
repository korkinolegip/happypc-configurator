"""
URL parser service — scrapes product name and price from store pages.

Strategy per store:
- Wildberries:   basket CDN (name, no bot-check) + card.wb.ru API (price)
- Ozon:          curl_cffi → __NEXT_DATA__ / inline JSON → stealth Playwright
- DNS-shop:      curl_cffi (Cloudflare bypass via Chrome TLS fingerprint)
- Avito:         curl_cffi → inline JSON → stealth Playwright + element extraction
- Yandex Market: curl_cffi → digitalData / __NEXT_DATA__ → stealth Playwright
- Others:        generic og tags via curl_cffi / httpx
"""
import json
import random
import re
from typing import Optional

import httpx

# ─── Constants ───────────────────────────────────────────────────────────────

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

# JavaScript injected into Playwright to defeat bot-detection
STEALTH_JS = """
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    Object.defineProperty(navigator, 'plugins', {
        get: () => [{name:'Chrome PDF Plugin',filename:'internal-pdf-viewer'},
                    {name:'Chrome PDF Viewer',filename:'mhjfbmdgcfjbbpaeojofohoefgiehjai'},
                    {name:'Native Client',filename:'internal-nacl-plugin'}]
    });
    Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU','ru','en-US','en']});
    Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 8});
    Object.defineProperty(navigator, 'deviceMemory', {get: () => 8});
    Object.defineProperty(screen, 'availHeight', {get: () => 768});
    Object.defineProperty(screen, 'availWidth', {get: () => 1366});
    window.chrome = {
        runtime: {onMessage:{addListener:()=>{}}, connect:()=>({onMessage:{addListener:()=>{}}})},
        loadTimes: ()=>({}), csi: ()=>({}), app: {}
    };
    if (navigator.permissions) {
        const _q = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = p =>
            p.name === 'notifications'
            ? Promise.resolve({state: Notification.permission, onchange: null})
            : _q(p);
    }
"""


# ─── Store detection ──────────────────────────────────────────────────────────

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


# ─── Generic HTML extractors ──────────────────────────────────────────────────

def _extract_og(html: str, tag: str) -> Optional[str]:
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
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    ):
        try:
            data = json.loads(m.group(1))
            items = data if isinstance(data, list) else [data]
            for item in items:
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
        except Exception:
            continue
    return None


def _extract_json_ld_name(html: str) -> Optional[str]:
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    ):
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
    """Generic page parser: JSON-LD → og tags → <title>."""
    name = _extract_json_ld_name(html)
    price = _extract_json_ld_price(html)

    if not name:
        name = _extract_og(html, "title")
    if not name:
        name = _extract_title_tag(html)
        if name and site_suffix:
            name = re.sub(
                rf"\s*[|—–\-]\s*{re.escape(site_suffix)}.*$", "", name, flags=re.IGNORECASE
            ).strip()

    if not price:
        for prop in ("price:amount", "price", "product:price:amount"):
            raw = _extract_og(html, prop)
            if raw:
                price = _clean_price(raw)
                if price:
                    break

    if not price:
        m = re.search(r'"price"\s*:\s*"?([\d\s]+(?:[.,]\d+)?)"?', html)
        if m:
            price = _clean_price(m.group(1))

    return {"name": name, "price": price, "store": store}


# ─── __NEXT_DATA__ helper ─────────────────────────────────────────────────────

def _extract_next_data(html: str) -> Optional[dict]:
    """Parse Next.js __NEXT_DATA__ script tag into a dict."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None


# ─── HTTP fetchers ────────────────────────────────────────────────────────────

def _get_proxy() -> str:
    """Return configured proxy URL, or empty string if none."""
    from app.config import settings
    return settings.SCRAPER_PROXY or ""


async def _cffi_fetch(url: str, referer: str = "") -> Optional[str]:
    """curl_cffi — Chrome TLS fingerprint, bypasses Cloudflare & most anti-bot."""
    try:
        from curl_cffi.requests import AsyncSession
        headers = {**BROWSER_HEADERS}
        if referer:
            headers["Referer"] = referer
        proxy = _get_proxy()
        kwargs = dict(headers=headers, impersonate="chrome124", timeout=15, allow_redirects=True)
        if proxy:
            kwargs["proxies"] = {"http": proxy, "https": proxy}
        async with AsyncSession() as session:
            resp = await session.get(url, **kwargs)
            if resp.status_code == 200:
                html = resp.text
                if not _is_bot_check(html[:3000]):
                    return html
    except ImportError:
        pass
    except Exception:
        pass
    return None


async def _httpx_fetch(url: str, referer: str = "") -> Optional[str]:
    """Standard httpx fetch as fallback."""
    headers = {**BROWSER_HEADERS}
    if referer:
        headers["Referer"] = referer
    try:
        proxy = _get_proxy()
        client_kwargs = dict(timeout=12, headers=headers, follow_redirects=True)
        if proxy:
            client_kwargs["proxy"] = proxy
        async with httpx.AsyncClient(**client_kwargs) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and not _is_bot_check(resp.text[:3000]):
                return resp.text
    except Exception:
        pass
    return None


async def _playwright_fetch(url: str, stealth: bool = False, wait_selector: str = "") -> Optional[str]:
    """
    Full JS render via Playwright.
    stealth=True injects STEALTH_JS to defeat bot-detection.
    wait_selector: CSS selector to wait for before grabbing HTML.
    """
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
            )
            context = await browser.new_context(
                user_agent=BROWSER_HEADERS["User-Agent"],
                locale="ru-RU",
                viewport={"width": 1366, "height": 768},
                extra_http_headers={"Accept-Language": "ru-RU,ru;q=0.9"},
            )
            if stealth:
                await context.add_init_script(STEALTH_JS)
            else:
                await context.add_init_script(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
                )
            page = await context.new_page()
            await page.wait_for_timeout(random.randint(300, 800))
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            if wait_selector:
                try:
                    await page.wait_for_selector(wait_selector, timeout=8000)
                except Exception:
                    pass
            else:
                await page.wait_for_timeout(random.randint(2500, 4000))
            html = await page.content()
            await browser.close()
            if _is_bot_check(html[:3000]):
                return None
            return html
    except Exception:
        return None


async def _fetch_url(url: str, referer: str = "") -> Optional[str]:
    """Try curl_cffi → httpx → Playwright (no stealth)."""
    html = await _cffi_fetch(url, referer)
    if html:
        return html
    html = await _httpx_fetch(url, referer)
    if html:
        return html
    return await _playwright_fetch(url)


# ─── Wildberries ──────────────────────────────────────────────────────────────

def _wb_basket(nm: int) -> str:
    """Calculate WB basket CDN server number from product nm."""
    vol = nm // 100000
    if vol <= 143:   return "01"
    if vol <= 287:   return "02"
    if vol <= 431:   return "03"
    if vol <= 719:   return "04"
    if vol <= 1007:  return "05"
    if vol <= 1061:  return "06"
    if vol <= 1115:  return "07"
    if vol <= 1169:  return "08"
    if vol <= 1313:  return "09"
    if vol <= 1601:  return "10"
    if vol <= 1655:  return "11"
    if vol <= 1919:  return "12"
    if vol <= 2045:  return "13"
    if vol <= 2189:  return "14"
    if vol <= 2405:  return "15"
    if vol <= 2621:  return "16"
    if vol <= 2837:  return "17"
    if vol <= 3053:  return "18"
    if vol <= 3269:  return "19"
    if vol <= 3485:  return "20"
    if vol <= 3701:  return "21"
    return "22"


async def _fetch_wildberries(url: str) -> dict:
    """
    WB name: basket CDN (global, no geo-block).
    WB price: card.wb.ru API (needs RU IP in production).
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

    # 1) Name from basket CDN (works globally)
    cdn_url = f"https://basket-{basket}.wbbasket.ru/vol{vol}/part{part}/{nm}/info/ru/card.json"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(cdn_url)
            if resp.status_code == 200:
                data = resp.json()
                imt_name = data.get("imt_name", "")
                brand = data.get("selling", {}).get("brand_name", "")
                if imt_name:
                    name = f"{brand} {imt_name}".strip() if brand else imt_name
    except Exception:
        pass

    # 2) Price from card API (needs RU IP)
    proxy = _get_proxy()
    for api_ver in ["v2", "v1"]:
        for dest in ["-1257786", "-1258185", "12358062", ""]:
            params = f"appType=1&curr=rub&nm={nm_str}"
            if dest:
                params += f"&dest={dest}"
            api_url = f"https://card.wb.ru/cards/{api_ver}/detail?{params}"
            try:
                client_kwargs = dict(timeout=8, headers=BROWSER_HEADERS)
                if proxy:
                    client_kwargs["proxy"] = proxy
                async with httpx.AsyncClient(**client_kwargs) as client:
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
        n = result.get("name", "")
        if n and any(s in n for s in ["Интернет-магазин", "широкий ассортимент", "Wildberries"]):
            return {"store": "wildberries"}
        return result
    return {}


# ─── Ozon ─────────────────────────────────────────────────────────────────────

def _ozon_extract_from_html(html: str) -> dict:
    """
    Multiple extraction strategies for Ozon:
    1. JSON-LD structured data
    2. __NEXT_DATA__ (Next.js)
    3. Ozon-specific inline JSON patterns
    4. og tags
    """
    name = _extract_json_ld_name(html)
    price = _extract_json_ld_price(html)

    # __NEXT_DATA__ — Ozon uses Next.js
    if not name or not price:
        nd = _extract_next_data(html)
        if nd:
            nd_str = json.dumps(nd)
            if not price:
                for pat in [
                    r'"finalPrice"\s*:\s*(\d+)',
                    r'"price"\s*:\s*(\d{3,7})',
                    r'"originalPrice"\s*:\s*(\d+)',
                ]:
                    pm = re.search(pat, nd_str)
                    if pm:
                        candidate = _clean_price(pm.group(1))
                        if candidate:
                            price = candidate
                            break
            if not name:
                nm = re.search(r'"name"\s*:\s*"([^"]{10,200})"', nd_str)
                if nm:
                    name = nm.group(1)

    # Ozon inline JSON patterns (common in SSR pages)
    if not price:
        for pat in [
            r'"finalPrice"\s*:\s*\{[^}]*"price"\s*:\s*"([\d\s]+)"',
            r'"price"\s*:\s*\{"amount"\s*:\s*(\d+)',
            r'"salePrice"\s*:\s*(\d{3,7})',
        ]:
            pm = re.search(pat, html)
            if pm:
                candidate = _clean_price(pm.group(1))
                if candidate:
                    price = candidate
                    break

    if not name:
        name = _extract_og(html, "title")
        if name:
            name = re.sub(r"\s*[—–|]\s*(?:OZON|Ozon).*$", "", name, flags=re.IGNORECASE).strip()

    return {"name": name, "price": price} if name else {}


async def _fetch_ozon(url: str) -> dict:
    """Ozon: curl_cffi → inline JSON → stealth Playwright."""
    html = await _cffi_fetch(url, referer="https://www.ozon.ru/")
    if html:
        result = _ozon_extract_from_html(html)
        if result.get("name"):
            result["store"] = "ozon"
            return result

    html = await _playwright_fetch(url, stealth=True, wait_selector="h1")
    if html:
        result = _ozon_extract_from_html(html)
        if result.get("name"):
            result["store"] = "ozon"
            return result

    return {"store": "ozon"}


# ─── Avito ────────────────────────────────────────────────────────────────────

def _avito_extract_from_html(html: str) -> dict:
    """
    Multiple strategies for Avito:
    1. JSON-LD
    2. Inline JSON (listing data embedded in page scripts)
    3. og:title with city/suffix stripping
    """
    name = _extract_json_ld_name(html)
    price = _extract_json_ld_price(html)

    if not name:
        for pat in [
            r'"title"\s*:\s*"([^"]{3,200})"',
            r'"name"\s*:\s*"([^"]{3,200})"',
        ]:
            m = re.search(pat, html)
            if m:
                candidate = m.group(1)
                if not any(skip in candidate for skip in ["Авито", "Avito", "объявлени"]):
                    name = candidate
                    break

    if not price:
        for pat in [
            r'"price"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)',
            r'"priceDetailed"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)',
            r'"price"\s*:\s*(\d{3,7})',
        ]:
            pm = re.search(pat, html)
            if pm:
                candidate = _clean_price(pm.group(1))
                if candidate:
                    price = candidate
                    break

    if not name:
        og = _extract_og(html, "title")
        if og:
            name = re.sub(r"\s*[—–|]\s*(?:Объявление\s+на\s+)?Авито.*$", "", og, flags=re.IGNORECASE).strip()
            name = re.sub(r"\s*—\s*[А-ЯЁ][а-яё\s\-]+$", "", name).strip()
            if name.lower() in ("авито", "avito", ""):
                name = None

    if not price:
        for prop in ("price:amount", "price"):
            raw = _extract_og(html, prop)
            if raw:
                price = _clean_price(raw)
                if price:
                    break

    return {"name": name, "price": price} if name else {}


async def _avito_playwright_extract(url: str) -> dict:
    """
    Stealth Playwright for Avito with direct element text extraction.
    More reliable than HTML parsing after JS renders.
    """
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox", "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage", "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1366,768",
                ],
            )
            context = await browser.new_context(
                user_agent=BROWSER_HEADERS["User-Agent"],
                locale="ru-RU",
                viewport={"width": 1366, "height": 768},
                extra_http_headers={"Accept-Language": "ru-RU,ru;q=0.9"},
            )
            await context.add_init_script(STEALTH_JS)
            page = await context.new_page()
            await page.wait_for_timeout(random.randint(500, 1200))
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

            name = None
            price = None

            # Try known Avito title selectors
            for title_sel in [
                'h1[data-marker="item-view/title-info"]',
                'h1[itemprop="name"]',
                'h1',
            ]:
                try:
                    await page.wait_for_selector(title_sel, timeout=5000)
                    name = await page.locator(title_sel).first.text_content()
                    if name:
                        name = name.strip()
                        break
                except Exception:
                    continue

            # Try known Avito price selectors
            for price_sel in [
                '[data-marker="item-view/item-price"] span',
                '[itemprop="price"]',
                'span[class*="price-value"]',
                'span[class*="Price"]',
            ]:
                try:
                    raw = await page.locator(price_sel).first.text_content()
                    if raw:
                        candidate = _clean_price(raw)
                        if candidate:
                            price = candidate
                            break
                except Exception:
                    continue

            # Fallback to inline JSON if element extraction failed
            if not name:
                html = await page.content()
                result = _avito_extract_from_html(html)
                name = result.get("name")
                if not price:
                    price = result.get("price")

            await browser.close()
            return {"name": name, "price": price} if name else {}
    except Exception:
        return {}


async def _fetch_avito(url: str) -> dict:
    """Avito: curl_cffi → inline JSON → stealth Playwright with element extraction."""
    html = await _cffi_fetch(url, referer="https://www.avito.ru/")
    if html:
        result = _avito_extract_from_html(html)
        if result.get("name"):
            result["store"] = "avito"
            return result

    result = await _avito_playwright_extract(url)
    if result.get("name"):
        result["store"] = "avito"
        return result

    return {"store": "avito"}


# ─── Yandex Market ────────────────────────────────────────────────────────────

def _yandex_extract_from_html(html: str) -> dict:
    """
    Multiple strategies for Yandex Market:
    1. JSON-LD
    2. digitalData analytics object (Yandex standard across all their services)
    3. __NEXT_DATA__ (Next.js)
    4. og tags
    """
    name = _extract_json_ld_name(html)
    price = _extract_json_ld_price(html)

    # digitalData — Yandex analytics layer, present on most YM pages
    if not name or not price:
        m = re.search(r'digitalData\s*=\s*(\{.{50,50000}?\})\s*;', html, re.DOTALL)
        if m:
            try:
                dd = json.loads(m.group(1))
                product = (
                    dd.get("product")
                    or (dd.get("listing") or {}).get("product")
                    or {}
                )
                if not name:
                    name = product.get("name")
                if not price:
                    raw_price = product.get("price") or product.get("unitSalePrice")
                    if raw_price:
                        price = _clean_price(str(raw_price))
            except Exception:
                pass

    # __NEXT_DATA__ fallback
    if not name or not price:
        nd = _extract_next_data(html)
        if nd:
            nd_str = json.dumps(nd)
            if not name:
                nm = re.search(r'"name"\s*:\s*"([^"]{5,200})"', nd_str)
                if nm:
                    name = nm.group(1)
            if not price:
                for pat in [r'"price"\s*:\s*(\d{3,7})', r'"value"\s*:\s*(\d{3,7})']:
                    pm = re.search(pat, nd_str)
                    if pm:
                        candidate = _clean_price(pm.group(1))
                        if candidate:
                            price = candidate
                            break

    if not name:
        name = _extract_og(html, "title")
        if name:
            name = re.sub(
                r"\s*[—–|]\s*(?:Яндекс\s*Маркет|Yandex\s*Market).*$", "", name, flags=re.IGNORECASE
            ).strip()
            name = re.sub(r"\s*[—–|]\s*купить.*$", "", name, flags=re.IGNORECASE).strip()

    return {"name": name, "price": price} if name else {}


async def _fetch_yandex_market(url: str) -> dict:
    """Yandex Market: curl_cffi → digitalData / __NEXT_DATA__ → stealth Playwright."""
    html = await _cffi_fetch(url, referer="https://market.yandex.ru/")
    if html:
        result = _yandex_extract_from_html(html)
        if result.get("name"):
            result["store"] = "yandex_market"
            return result

    html = await _playwright_fetch(url, stealth=True, wait_selector="h1")
    if html:
        result = _yandex_extract_from_html(html)
        if result.get("name"):
            result["store"] = "yandex_market"
            return result

    return {"store": "yandex_market"}


# ─── DNS-shop ─────────────────────────────────────────────────────────────────

async def _fetch_dns(url: str) -> dict:
    """DNS-shop: curl_cffi bypasses Cloudflare."""
    html = await _fetch_url(url, referer="https://www.dns-shop.ru/")
    if not html:
        return {"store": "dns"}
    result = _parse_html(html, "dns", "DNS")
    if result.get("name"):
        result["name"] = re.sub(r"\s*[—–-]\s*DNS.*$", "", result["name"]).strip()
        result["name"] = re.sub(r"\s*[—–-]\s*купить.*$", "", result["name"], flags=re.IGNORECASE).strip()
    return result


# ─── Generic ──────────────────────────────────────────────────────────────────

async def _fetch_generic(url: str, store: str) -> dict:
    html = await _fetch_url(url)
    if not html:
        return {"store": store if store != "unknown" else None}
    result = _parse_html(html, store)
    if result.get("name"):
        for suffix in ["Citilink", "М.Видео", "МегаМаркет", "Эльдорадо", "AliExpress"]:
            result["name"] = re.sub(
                rf"\s*[—–|]\s*{re.escape(suffix)}.*$", "", result["name"], flags=re.IGNORECASE
            ).strip()
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

        if not result.get("store") and base.get("store"):
            result["store"] = base["store"]

        return result if result else base

    except Exception:
        return base
