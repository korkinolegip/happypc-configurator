"""
URL parser service — extracts product name and price from store URLs.

Performance layers:
1. Cache — same URL returns cached result for 24h (instant)
2. Browser pool — single Camoufox browser, reused across requests
3. Queue — max 2 concurrent scrapes, rest wait in line

Strategy (priority order):
- Wildberries:   basket CDN (name) + Camoufox internal API (price) on VPS
- Ozon:          Camoufox (primary) → ZenRows (fallback)
- DNS-shop:      Camoufox + cookie consent (VPS/iMac) → iMac scraper → ZenRows
- Yandex Market: Camoufox (primary) → Apify (fallback)
- Avito:         Camoufox + modal close (works on VPS)
- Others:        curl_cffi / httpx generic fallback
"""
import asyncio
import json
import logging
import re
import time
import threading
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# ─── Layer 1: Cache ─────────────────────────────────────────────────────────

_cache: dict[str, dict] = {}  # url -> {"result": {...}, "ts": float}
CACHE_TTL = 86400  # 24 hours


def _normalize_url(url: str) -> str:
    """Normalize URL for cache key (strip tracking params)."""
    url = url.split("?")[0].split("#")[0].rstrip("/")
    return url.lower()


def _cache_get(url: str) -> Optional[dict]:
    key = _normalize_url(url)
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["result"]
    if entry:
        del _cache[key]
    return None


def _cache_set(url: str, result: dict):
    if result.get("name"):  # only cache successful results
        key = _normalize_url(url)
        _cache[key] = {"result": result, "ts": time.time()}
        # Evict old entries if cache grows too large
        if len(_cache) > 1000:
            oldest = sorted(_cache.items(), key=lambda x: x[1]["ts"])[:200]
            for k, _ in oldest:
                _cache.pop(k, None)


# ─── Layer 2: Browser pool (single Camoufox, reused) ────────────────────────

_browser_instance = None
_browser_lock = threading.Lock()


def _get_browser():
    """Get or create shared Camoufox browser instance."""
    global _browser_instance
    with _browser_lock:
        if _browser_instance is None:
            try:
                from camoufox.sync_api import Camoufox
                ctx = Camoufox(headless=True)
                _browser_instance = ctx.__enter__()
            except Exception:
                return None
        return _browser_instance


def _close_modals(page):
    """Close common modals: cookie consent, app promo, etc."""
    selectors = [
        'button:has-text("Принять")',
        'button:has-text("Согласен")',
        'button:has-text("Хорошо")',
        'button:has-text("Принимаю")',
        'button:has-text("OK")',
        'button:has-text("Понятно")',
        'button:has-text("Остаться в браузере")',
        'button:has-text("Закрыть")',
        'button:has-text("Нет, спасибо")',
        '.cookie-notice__button',
        '.cookies-policy__button',
        '[data-role="cookie-accept"]',
        '.app-banner__close',
        '.modal__close',
        '.popup__close',
        '[data-role="close"]',
        '[data-marker="close"]',
    ]
    import time as t
    for sel in selectors:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click()
                t.sleep(0.5)
        except Exception:
            pass


def _scrape_with_pool(url: str, wait_seconds: int = 8, cookies: list | None = None) -> Optional[str]:
    """Scrape URL using shared browser (new tab, not new browser)."""
    browser = _get_browser()
    if not browser:
        return None
    try:
        page = browser.new_page()
        try:
            if cookies:
                page.context.add_cookies(cookies)
            page.goto(url, timeout=25000)
            import time as t
            t.sleep(3)
            _close_modals(page)
            t.sleep(wait_seconds - 3 if wait_seconds > 3 else wait_seconds)
            title = page.title()
            blocked = [
                "Почти готово", "Доступ ограничен", "HTTP 403",
                "captcha", "робот", "Подтвердите",
            ]
            if any(b.lower() in title.lower() for b in blocked):
                return None
            return page.content()
        finally:
            page.close()
    except Exception:
        # Browser might be dead, reset it
        global _browser_instance
        try:
            _browser_instance = None
        except Exception:
            pass
        return None


# ─── Layer 3: Queue (limit concurrent scrapes) ──────────────────────────────

_scrape_semaphore = asyncio.Semaphore(2)  # max 2 concurrent browser scrapes


async def _camoufox_fetch(url: str, wait_seconds: int = 8, cookies: list | None = None) -> Optional[str]:
    """Fetch URL via Camoufox with concurrency control."""
    async with _scrape_semaphore:
        try:
            loop = asyncio.get_event_loop()
            return await asyncio.wait_for(
                loop.run_in_executor(
                    None, _scrape_with_pool, url, wait_seconds, cookies
                ),
                timeout=60,
            )
        except (asyncio.TimeoutError, Exception):
            return None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _detect_store(url: str) -> str:
    u = url.lower()
    if "wildberries.ru" in u or "wb.ru" in u:
        return "wildberries"
    if "dns-shop.ru" in u:
        return "dns"
    if "ozon.ru" in u:
        return "ozon"
    if "avito.ru" in u:
        return "avito"
    if "market.yandex.ru" in u or "yandex.ru/market" in u:
        return "yandex_market"
    if "megamarket.ru" in u:
        return "megamarket"
    if "citilink.ru" in u:
        return "citilink"
    if "mvideo.ru" in u:
        return "mvideo"
    if "eldorado.ru" in u:
        return "eldorado"
    if "aliexpress" in u:
        return "aliexpress"
    return "unknown"


def _clean_price(raw: str) -> Optional[float]:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.,]", "", str(raw).replace("\xa0", "").replace("\u2009", ""))
    cleaned = cleaned.replace(",", ".")
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        val = float(cleaned)
        return val if 1 <= val <= 10_000_000 else None
    except ValueError:
        return None


def _extract_from_html(html: str) -> dict:
    """Universal HTML extractor: JSON-LD → H1 → OG → price patterns."""
    name = price = None

    # JSON-LD
    for m in re.finditer(
        r'application/ld\+json["\x27][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE
    ):
        try:
            data = json.loads(m.group(1))
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") in ("Product", "Offer"):
                    if not name:
                        name = item.get("name")
                    offers = item.get("offers", item)
                    if isinstance(offers, dict) and not price:
                        p = offers.get("price") or offers.get("lowPrice")
                        if p:
                            price = _clean_price(str(p))
                    elif isinstance(offers, list) and offers and not price:
                        p = offers[0].get("price") or offers[0].get("lowPrice")
                        if p:
                            price = _clean_price(str(p))
        except Exception:
            continue

    # H1
    if not name:
        m = re.search(r'<h1[^>]*>(.*?)</h1>', html[:200000], re.DOTALL)
        if m:
            import html as html_lib
            text = re.sub(r'<[^>]+>', '', m.group(1)).strip()
            name = html_lib.unescape(text) if text else None

    # OG title
    if not name:
        for pattern in [
            r'og:title["\x27][^>]+content=["\x27]([^"\x27]+)',
            r'content=["\x27]([^"\x27]+)["\x27][^>]+og:title',
        ]:
            m = re.search(pattern, html[:30000], re.IGNORECASE)
            if m:
                name = m.group(1).strip()
                break

    # Price fallbacks
    if not price:
        for pat in [
            r'content="(\d+)"\s*itemprop="price"',
            r'itemprop="price"[^>]*content="(\d+)"',
            r'"cardPrice":\s*"([\d\s]+)"',
            r'"finalPrice":\s*"?([\d\s]+)',
            r'price-current[^>]*>.*?(\d[\d\s\xa0]*\d)',
            r'(\d[\d\xa0\s]{2,8})\s*₽',
        ]:
            pm = re.search(pat, html[:300000], re.DOTALL)
            if pm:
                raw = pm.group(1).replace('\xa0', '').replace(' ', '')
                if raw.isdigit() and int(raw) > 100:
                    price = float(raw)
                    break

    return {"name": name, "price": price}


# ─── iMac scraper (home IP) ─────────────────────────────────────────────────

async def _imac_scrape(url: str) -> dict:
    """Call iMac scraping microservice (Camoufox on home IP)."""
    from app.config import settings
    base = settings.IMAC_SCRAPER_URL
    if not base:
        return {}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(f"{base}/scrape", params={"url": url})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("name") and not data.get("error"):
                    return data
    except Exception:
        pass
    return {}


# ─── ZenRows fetch (paid fallback) ──────────────────────────────────────────

async def _zenrows_fetch(url: str, wait: str = "10000") -> Optional[str]:
    """Fetch URL via ZenRows API with JS rendering and anti-bot bypass."""
    from app.config import settings
    api_key = settings.ZENROWS_API_KEY
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.get("https://api.zenrows.com/v1/", params={
                "apikey": api_key,
                "url": url,
                "js_render": "true",
                "antibot": "true",
                "premium_proxy": "true",
                "wait": wait,
            })
            if resp.status_code == 200:
                return resp.text
    except Exception:
        pass
    return None


# ─── Wildberries ─────────────────────────────────────────────────────────────

def _wb_basket(nm: int) -> str:
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


def _wb_fetch_price_via_internal(nm: int) -> Optional[float]:
    """Fetch WB product price via __internal/u-card API (requires Camoufox session)."""
    browser = _get_browser()
    if not browser:
        return None
    try:
        page = browser.new_page()
        try:
            # Visit WB main page to get session/cookies
            page.goto("https://www.wildberries.ru/", timeout=40000)
            import time as t
            t.sleep(15)
            _close_modals(page)
            t.sleep(2)

            title = page.title()
            if not title or "Почти" in title:
                return None

            # Fetch price from internal API in page context
            api_url = f"https://www.wildberries.ru/__internal/u-card/cards/v4/list?appType=1&curr=rub&dest=-1257786&lang=ru&nm={nm}"
            result = page.evaluate(f"""async () => {{
                try {{
                    const r = await fetch('{api_url}');
                    if (!r.ok) return null;
                    const data = await r.json();
                    const products = data.products || [];
                    if (products.length === 0) return null;
                    const p = products[0];
                    const sizes = p.sizes || [];
                    if (sizes.length && sizes[0].price) {{
                        return sizes[0].price.product || sizes[0].price.total || null;
                    }}
                    return p.salePriceU || null;
                }} catch(e) {{ return null; }}
            }}""")

            if result and isinstance(result, (int, float)) and result > 0:
                # WB API returns price in kopecks (e.g. 4480000 = 44800 rub)
                # sizes[0].price.product is in kopecks, divide by 100
                price = float(result) / 100
                return price
        finally:
            page.close()
    except Exception:
        pass
    return None


async def _fetch_wildberries(url: str) -> dict:
    m = re.search(r"/catalog/(\d+)", url)
    if not m:
        return {}
    nm = int(m.group(1))
    vol = nm // 100000
    part = nm // 1000
    basket = _wb_basket(nm)

    name = None
    price = None

    # 1) Name from basket CDN (free, works globally)
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

    # 2) Price via internal API (works on VPS without proxy)
    if name:
        async with _scrape_semaphore:
            try:
                loop = asyncio.get_event_loop()
                wb_price = await asyncio.wait_for(
                    loop.run_in_executor(None, _wb_fetch_price_via_internal, nm),
                    timeout=60,
                )
                if wb_price:
                    price = wb_price
            except (asyncio.TimeoutError, Exception):
                pass

    return {"name": name, "price": price, "store": "wildberries"} if name else {}


# ─── Ozon ────────────────────────────────────────────────────────────────────

_OZON_COOKIES = [
    {"name": "abt_data", "value": "7", "domain": ".ozon.ru", "path": "/"},
    {"name": "__Secure-ab-group", "value": "77", "domain": ".ozon.ru", "path": "/"},
    {"name": "ADDRESSBOOKBAR_WEB_CLARIFICATION", "value": "1", "domain": ".ozon.ru", "path": "/"},
    {"name": "xcid", "value": "1", "domain": ".ozon.ru", "path": "/"},
]


def _is_valid_ozon_name(name: str | None, url: str) -> bool:
    """Check if Ozon returned the correct product, not a redirect."""
    if not name:
        return False
    # Ozon antibot sometimes redirects to random products
    # Try to match URL slug with product name
    bad = ["ozon", "главная", "antibot", "captcha", "подтвердите"]
    if any(b in name.lower() for b in bad):
        return False
    return len(name) > 5


async def _fetch_ozon(url: str) -> dict:
    # 1) Camoufox with cookie consent (free)
    html = await _camoufox_fetch(url, wait_seconds=10, cookies=_OZON_COOKIES)
    if html:
        logger.warning(f"[OZON] Camoufox got HTML ({len(html)} chars), title: {re.search(r'<title>(.*?)</title>', html[:5000], re.DOTALL)}")
        with open("/tmp/ozon_debug.html", "w") as f:
            f.write(html[:50000])
        result = _extract_from_html(html)
        logger.warning(f"[OZON] Extracted: name={result.get('name')!r}, price={result.get('price')}")
        if _is_valid_ozon_name(result.get("name"), url):
            name = re.sub(r"\s*[—–|]\s*(?:OZON|Ozon|купить).*$", "", result["name"], flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "ozon"}
        else:
            logger.warning(f"[OZON] Name rejected by validation: {result.get('name')!r}")
    else:
        logger.warning("[OZON] Camoufox returned no HTML")

    # 2) ZenRows fallback (paid)
    html = await _zenrows_fetch(url)
    if html:
        logger.warning(f"[OZON] ZenRows got HTML ({len(html)} chars)")
        result = _extract_from_html(html)
        logger.warning(f"[OZON] ZenRows extracted: name={result.get('name')!r}, price={result.get('price')}")
        if _is_valid_ozon_name(result.get("name"), url):
            name = re.sub(r"\s*[—–|]\s*(?:OZON|Ozon|купить).*$", "", result["name"], flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "ozon"}
    else:
        logger.warning("[OZON] ZenRows also returned no HTML")

    return {"store": "ozon"}


# ─── DNS-shop ────────────────────────────────────────────────────────────────

def _is_valid_dns_name(name: str | None) -> bool:
    """Check if DNS returned a real product name, not an error/stub."""
    if not name:
        return False
    stubs = ["извините", "отсутствует", "не найден", "ошибка", "404", "access denied"]
    lower = name.lower()
    return not any(s in lower for s in stubs) and len(name) > 5


_DNS_COOKIES = [
    {"name": "cookie-policy-agree", "value": "1", "domain": ".dns-shop.ru", "path": "/"},
    {"name": "cookies_accepted", "value": "1", "domain": ".dns-shop.ru", "path": "/"},
    {"name": "cookie_accepted", "value": "true", "domain": ".dns-shop.ru", "path": "/"},
    {"name": "city_path", "value": "moscow", "domain": ".dns-shop.ru", "path": "/"},
    {"name": "app-promo-banner-closed", "value": "1", "domain": ".dns-shop.ru", "path": "/"},
    {"name": "mobile-app-banner", "value": "closed", "domain": ".dns-shop.ru", "path": "/"},
]


def _clean_dns_name(name: str) -> str:
    return re.sub(r"\s*[—–|-]\s*(?:DNS|купить).*$", "", name, flags=re.IGNORECASE).strip()


async def _fetch_dns(url: str) -> dict:
    # 1) Camoufox with cookie consent (works on VPS + iMac)
    html = await _camoufox_fetch(url, wait_seconds=12, cookies=_DNS_COOKIES)
    if html:
        result = _extract_from_html(html)
        if _is_valid_dns_name(result.get("name")):
            return {"name": _clean_dns_name(result["name"]), "price": result.get("price"), "store": "dns"}

    # 2) iMac scraper (home IP, bypasses Qrator)
    result = await _imac_scrape(url)
    if _is_valid_dns_name(result.get("name")):
        return {"name": _clean_dns_name(result["name"]), "price": result.get("price"), "store": "dns"}

    # 3) ZenRows (paid fallback)
    html = await _zenrows_fetch(url, wait="12000")
    if html:
        result = _extract_from_html(html)
        if _is_valid_dns_name(result.get("name")):
            return {"name": _clean_dns_name(result["name"]), "price": result.get("price"), "store": "dns"}

    return {"store": "dns"}


# ─── Yandex Market ───────────────────────────────────────────────────────────

async def _fetch_yandex_market(url: str) -> dict:
    # 1) Camoufox (free)
    html = await _camoufox_fetch(url, wait_seconds=10)
    if html:
        result = _extract_from_html(html)
        name = result.get("name")
        if name and not any(s in name.lower() for s in ["confirme", "captcha", "робот"]):
            name = re.sub(r"\s*[—–|]\s*(?:Яндекс|Yandex|купить).*$", "", name, flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "yandex_market"}

    # 2) Apify fallback (free tier)
    result = await _apify_yandex_market(url)
    if result.get("name"):
        return result

    return {"store": "yandex_market"}


async def _apify_yandex_market(url: str) -> dict:
    """Fetch YM product via Apify zen-studio~yandex-market-scraper-parser."""
    from app.config import settings
    token = settings.APIFY_TOKEN
    if not token:
        return {}

    m = re.search(r'/card/([^/]+)', url) or re.search(r'/product[/-]+([^/]+)', url)
    if not m:
        return {}
    slug = m.group(1)
    query = slug.replace("-", " ").strip()
    query = re.sub(r'\d{8,}$', '', query).strip()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.apify.com/v2/acts/zen-studio~yandex-market-scraper-parser/runs",
                params={"token": token},
                json={"query": query, "maxItems": 1},
            )
            if resp.status_code not in (200, 201):
                return {}

            run_data = resp.json().get("data", {})
            run_id = run_data.get("id")
            dataset_id = run_data.get("defaultDatasetId")
            if not run_id:
                return {}

            status = None
            for _ in range(12):
                await asyncio.sleep(5)
                r = await client.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": token},
                )
                status = r.json().get("data", {}).get("status")
                if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                    break

            if status != "SUCCEEDED" or not dataset_id:
                return {}

            r = await client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": token},
            )
            items = r.json()
            if not items:
                return {}

            item = items[0]
            name = item.get("title") or item.get("modelName")
            price = item.get("price") or item.get("currentPrice")
            if price:
                price = _clean_price(str(price))

            return {"name": name, "price": price, "store": "yandex_market"} if name else {}

    except Exception:
        return {}


# ─── Avito ───────────────────────────────────────────────────────────────────

def _avito_scrape(url: str) -> Optional[str]:
    """Scrape Avito with captcha/block handling (click 'Продолжить')."""
    browser = _get_browser()
    if not browser:
        return None
    try:
        page = browser.new_page()
        try:
            page.goto(url, timeout=30000)
            import time as t
            t.sleep(3)

            # Handle "Доступ ограничен" — click "Продолжить" button
            try:
                btn = page.query_selector('button:has-text("Продолжить")')
                if btn and btn.is_visible():
                    btn.click()
                    t.sleep(8)
            except Exception:
                pass

            _close_modals(page)
            t.sleep(5)

            title = page.title()
            if "ограничен" in (title or "").lower():
                return None
            return page.content()
        finally:
            page.close()
    except Exception:
        global _browser_instance
        _browser_instance = None
        return None


async def _fetch_avito(url: str) -> dict:
    # 1) Camoufox with captcha handling
    async with _scrape_semaphore:
        try:
            loop = asyncio.get_event_loop()
            html = await asyncio.wait_for(
                loop.run_in_executor(None, _avito_scrape, url),
                timeout=60,
            )
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"[AVITO] Camoufox error: {e}")
            html = None
    if html:
        logger.warning(f"[AVITO] Camoufox got HTML ({len(html)} chars), title: {re.search(r'<title>(.*?)</title>', html[:5000], re.DOTALL)}")
        with open("/tmp/avito_debug.html", "w") as f:
            f.write(html[:50000])
        result = _extract_from_html(html)
        logger.warning(f"[AVITO] Extracted: name={result.get('name')!r}, price={result.get('price')}")
        name = result.get("name")
        if name:
            for suffix in ["Авито", "Avito", "Объявление"]:
                name = re.sub(rf"\s*[—–|]\s*(?:на\s+)?{suffix}.*$", "", name, flags=re.IGNORECASE).strip()
            import html as html_lib
            name = html_lib.unescape(name)
            name = re.sub(r"\s*(?:купить|в\s+\w+\s+по).*$", "", name, flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "avito"}

    # 2) iMac scraper fallback (home IP, no captcha)
    result = await _imac_scrape(url)
    if result.get("name") and not result.get("error"):
        name = result["name"]
        for suffix in ["Авито", "Avito", "Объявление"]:
            name = re.sub(rf"\s*[—–|]\s*(?:на\s+)?{suffix}.*$", "", name, flags=re.IGNORECASE).strip()
        import html as html_lib
        name = html_lib.unescape(name)
        name = re.sub(r"\s*(?:купить|в\s+\w+\s+по).*$", "", name, flags=re.IGNORECASE).strip()
        return {"name": name, "price": result.get("price"), "store": "avito"}

    # 3) ZenRows fallback (paid)
    html = await _zenrows_fetch(url)
    if html:
        result = _extract_from_html(html)
        name = result.get("name")
        if name:
            for suffix in ["Авито", "Avito"]:
                name = re.sub(rf"\s*[—–|]\s*(?:на\s+)?{suffix}.*$", "", name, flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "avito"}

    return {"store": "avito"}


# ─── Generic (curl_cffi / httpx) ─────────────────────────────────────────────

async def _fetch_generic(url: str, store: str) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0",
        "Accept-Language": "ru-RU,ru;q=0.9",
    }
    html = None
    try:
        from curl_cffi.requests import AsyncSession
        async with AsyncSession() as session:
            resp = await session.get(url, headers=headers, impersonate="chrome124", timeout=15)
            if resp.status_code == 200:
                html = resp.text
    except Exception:
        pass
    if not html:
        try:
            async with httpx.AsyncClient(timeout=12, headers=headers, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    html = resp.text
        except Exception:
            pass
    if not html:
        html = await _camoufox_fetch(url)
    if not html:
        return {"store": store if store != "unknown" else None}

    result = _extract_from_html(html)
    name = result.get("name")
    if name:
        for suffix in ["Citilink", "М.Видео", "МегаМаркет", "Эльдорадо", "AliExpress"]:
            name = re.sub(rf"\s*[—–|]\s*{re.escape(suffix)}.*$", "", name, flags=re.IGNORECASE).strip()
    return {"name": name, "price": result.get("price"), "store": store}


# ─── Public entry point ──────────────────────────────────────────────────────

async def parse_product_url(url: str) -> dict:
    """Parse a product URL and return {name, price, store}.

    Layer 1: Check cache first (instant if cached).
    Layer 2: Browser pool (single browser, reused).
    Layer 3: Queue (max 2 concurrent scrapes).
    """
    # Layer 1: Cache
    cached = _cache_get(url)
    if cached:
        return cached

    store = _detect_store(url)
    base = {"store": store if store != "unknown" else None}

    try:
        if store == "wildberries":
            result = await _fetch_wildberries(url)
        elif store == "ozon":
            result = await _fetch_ozon(url)
        elif store == "dns":
            result = await _fetch_dns(url)
        elif store == "yandex_market":
            result = await _fetch_yandex_market(url)
        elif store == "avito":
            result = await _fetch_avito(url)
        else:
            result = await _fetch_generic(url, store)

        if result.get("name"):
            result["name"] = result["name"][:200].strip()

        if not result.get("store") and base.get("store"):
            result["store"] = base["store"]

        final = result if result else base

        # Cache successful result
        _cache_set(url, final)

        return final

    except Exception:
        return base
