"""
URL parser service — extracts product name and price from store URLs.

Strategy (priority order):
- Wildberries:   basket CDN (name, free) + Camoufox (price)
- Ozon:          Camoufox (primary) → ZenRows (fallback)
- DNS-shop:      Camoufox (primary) → ZenRows (fallback)
- Yandex Market: Camoufox (primary) → Apify (fallback)
- Avito:         Camoufox (primary) → ZenRows (fallback)
- Others:        curl_cffi / httpx generic fallback

Camoufox = anti-detect Firefox browser, free, works on home IP.
ZenRows/Apify = paid fallback for datacenter IPs.
"""
import asyncio
import json
import re
from typing import Optional

import httpx


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


# ─── Camoufox (anti-detect browser) ─────────────────────────────────────────

async def _camoufox_fetch(url: str, wait_seconds: int = 8) -> Optional[str]:
    """Fetch URL via Camoufox (anti-detect Firefox). Returns rendered HTML."""
    try:
        return await asyncio.wait_for(
            _camoufox_fetch_inner(url, wait_seconds), timeout=60
        )
    except (asyncio.TimeoutError, Exception):
        return None


async def _camoufox_fetch_inner(url: str, wait_seconds: int) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _camoufox_fetch_sync, url, wait_seconds)


def _camoufox_fetch_sync(url: str, wait_seconds: int) -> Optional[str]:
    try:
        from camoufox.sync_api import Camoufox
        import time
        with Camoufox(headless=True) as browser:
            page = browser.new_page()
            page.goto(url, timeout=25000)
            time.sleep(wait_seconds)
            title = page.title()
            # Check for bot-detection pages
            blocked = [
                "Почти готово", "Доступ ограничен", "HTTP 403",
                "captcha", "робот", "Подтвердите",
            ]
            if any(b.lower() in title.lower() for b in blocked):
                return None
            return page.content()
    except Exception:
        return None


# ─── iMac scraper (home IP) ──────────────────────────────────────────────────

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

    # 2) Price via Camoufox (WB blocks aggressively, may not work)
    if name:
        html = await _camoufox_fetch(url, wait_seconds=8)
        if html:
            result = _extract_from_html(html)
            if result.get("price"):
                price = result["price"]
            # Validate name isn't homepage
            page_name = result.get("name", "")
            if page_name and "Wildberries" not in page_name and "широкий ассортимент" not in page_name:
                if not name:
                    name = page_name

    return {"name": name, "price": price, "store": "wildberries"} if name else {}


# ─── Ozon ────────────────────────────────────────────────────────────────────

async def _fetch_ozon(url: str) -> dict:
    # 1) Camoufox (free)
    html = await _camoufox_fetch(url)
    if html:
        result = _extract_from_html(html)
        if result.get("name"):
            return {"name": result["name"], "price": result.get("price"), "store": "ozon"}

    # 2) ZenRows fallback (paid)
    html = await _zenrows_fetch(url)
    if html:
        result = _extract_from_html(html)
        if result.get("name"):
            return {"name": result["name"], "price": result.get("price"), "store": "ozon"}

    return {"store": "ozon"}


# ─── DNS-shop ────────────────────────────────────────────────────────────────

async def _fetch_dns(url: str) -> dict:
    # 1) iMac scraper (home IP, bypasses Qrator)
    result = await _imac_scrape(url)
    if result.get("name"):
        name = re.sub(r"\s*[—–|-]\s*(?:DNS|купить).*$", "", result["name"], flags=re.IGNORECASE).strip()
        return {"name": name, "price": result.get("price"), "store": "dns"}

    # 2) Camoufox local (works on home IP server)
    html = await _camoufox_fetch(url, wait_seconds=10)
    if html:
        result = _extract_from_html(html)
        if result.get("name"):
            name = re.sub(r"\s*[—–|-]\s*(?:DNS|купить).*$", "", result["name"], flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "dns"}

    # 3) ZenRows fallback (paid)
    html = await _zenrows_fetch(url, wait="12000")
    if html:
        result = _extract_from_html(html)
        if result.get("name"):
            name = re.sub(r"\s*[—–|-]\s*(?:DNS|купить).*$", "", result["name"], flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "dns"}

    return {"store": "dns"}


# ─── Yandex Market ───────────────────────────────────────────────────────────

async def _fetch_yandex_market(url: str) -> dict:
    # 1) Camoufox (free)
    html = await _camoufox_fetch(url, wait_seconds=10)
    if html:
        result = _extract_from_html(html)
        name = result.get("name")
        # Filter captcha/error pages
        if name and not any(s in name.lower() for s in ["confirme", "captcha", "робот", "ошейник"]):
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

async def _fetch_avito(url: str) -> dict:
    # 1) Camoufox (free, works on home IP)
    html = await _camoufox_fetch(url)
    if html:
        result = _extract_from_html(html)
        name = result.get("name")
        if name:
            for suffix in ["Авито", "Avito", "Объявление"]:
                name = re.sub(rf"\s*[—–|]\s*(?:на\s+)?{suffix}.*$", "", name, flags=re.IGNORECASE).strip()
            import html as html_lib
            name = html_lib.unescape(name)
            name = re.sub(r"\s*(?:купить|в\s+\w+\s+по).*$", "", name, flags=re.IGNORECASE).strip()
            return {"name": name, "price": result.get("price"), "store": "avito"}

    # 2) ZenRows fallback (paid)
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
    """Parse a product URL and return {name, price, store}."""
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

        return result if result else base

    except Exception:
        return base
