"""
URL parser service — extracts product name and price from store URLs.

Strategy:
- Wildberries: basket CDN (name) + ZenRows (price)
- Ozon:        ZenRows (js_render + antibot)
- DNS-shop:    ZenRows (js_render + antibot)
- Yandex Market: ZenRows (js_render + antibot)
- Avito:       ZenRows (js_render + antibot)
- Others:      curl_cffi / httpx generic fallback
"""
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


def _extract_json_ld(html: str) -> dict:
    """Extract name and price from JSON-LD structured data."""
    name = price = None
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
    return {"name": name, "price": price}


def _extract_og_title(html: str) -> Optional[str]:
    for pattern in [
        r'og:title["\x27][^>]+content=["\x27]([^"\x27]+)',
        r'content=["\x27]([^"\x27]+)["\x27][^>]+og:title',
    ]:
        m = re.search(pattern, html[:30000], re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _extract_h1(html: str) -> Optional[str]:
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html[:200000], re.DOTALL)
    if m:
        text = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        import html as html_lib
        return html_lib.unescape(text) if text else None
    return None


# ─── ZenRows fetch ───────────────────────────────────────────────────────────

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

    # 2) Price from ZenRows (rendered page)
    if name:
        html = await _zenrows_fetch(url, wait="12000")
        if html:
            # Try JSON-LD first
            ld = _extract_json_ld(html)
            if ld.get("price"):
                price = ld["price"]
            else:
                # Regex patterns for WB price
                for pat in [
                    r'price-block__final-price[^>]*>([\d\s]+)',
                    r'"finalPrice":\s*"?([\d\s]+)',
                    r'"priceForProduct"[^}]*"basicPrice":\s*(\d+)',
                    r'price__lower[^>]*>([\d\s]+)',
                ]:
                    pm = re.search(pat, html)
                    if pm:
                        price = _clean_price(pm.group(1))
                        if price:
                            break

    return {"name": name, "price": price, "store": "wildberries"} if name else {}


# ─── Ozon ────────────────────────────────────────────────────────────────────

async def _fetch_ozon(url: str) -> dict:
    html = await _zenrows_fetch(url)
    if not html:
        return {"store": "ozon"}

    ld = _extract_json_ld(html)
    name = ld.get("name")
    price = ld.get("price")

    if not name:
        name = _extract_h1(html)
    if not name:
        og = _extract_og_title(html)
        if og:
            name = re.sub(r"\s*[—–|]\s*(?:OZON|Ozon).*$", "", og).strip()

    if not price:
        for pat in [
            r'"cardPrice":\s*"([\d\s]+)',
            r'"finalPrice":\s*"?([\d\s]+)',
            r'"price":\s*"([\d\s]+)\s*₽',
        ]:
            pm = re.search(pat, html)
            if pm:
                price = _clean_price(pm.group(1))
                if price:
                    break

    return {"name": name, "price": price, "store": "ozon"} if name else {"store": "ozon"}


# ─── DNS-shop ────────────────────────────────────────────────────────────────

async def _fetch_dns(url: str) -> dict:
    html = await _zenrows_fetch(url, wait="12000")
    if not html:
        return {"store": "dns"}

    ld = _extract_json_ld(html)
    name = ld.get("name")
    price = ld.get("price")

    if not name:
        name = _extract_h1(html)
    if not name:
        og = _extract_og_title(html)
        if og:
            name = re.sub(r"\s*[—–|-]\s*(?:DNS|купить).*$", "", og, flags=re.IGNORECASE).strip()

    if not price:
        for pat in [r'"price":\s*"?([\d\s]+)', r'product-buy__price[^>]*>([\d\s]+)']:
            pm = re.search(pat, html)
            if pm:
                price = _clean_price(pm.group(1))
                if price:
                    break

    return {"name": name, "price": price, "store": "dns"} if name else {"store": "dns"}


# ─── Yandex Market ───────────────────────────────────────────────────────────

async def _fetch_yandex_market(url: str) -> dict:
    """YM: Apify scraper (primary) → ZenRows (fallback)."""
    # 1) Try Apify YM scraper — reliable, bypasses SmartCaptcha
    result = await _apify_yandex_market(url)
    if result.get("name"):
        return result

    # 2) ZenRows fallback
    html = await _zenrows_fetch(url, wait="15000")
    if html:
        ld = _extract_json_ld(html)
        name = ld.get("name") or _extract_h1(html)
        price = ld.get("price")
        if not price:
            pm = re.search(r'price-current[^>]*>.*?(\d[\d\s]*\d)', html[:200000], re.DOTALL)
            if pm:
                price = _clean_price(pm.group(1))
        if name and not any(s in name.lower() for s in ["confirme", "captcha", "робот"]):
            return {"name": name, "price": price, "store": "yandex_market"}

    return {"store": "yandex_market"}


async def _apify_yandex_market(url: str) -> dict:
    """Fetch YM product via Apify zen-studio~yandex-market-scraper-parser."""
    import asyncio
    from app.config import settings
    token = settings.APIFY_TOKEN
    if not token:
        return {}

    # Extract search query from URL slug
    m = re.search(r'/card/([^/]+)', url) or re.search(r'/product[/-]+([^/]+)', url)
    if not m:
        return {}
    slug = m.group(1)
    # Convert slug to human-readable query
    query = slug.replace("-", " ").strip()
    # Remove common suffixes
    query = re.sub(r'\d{8,}$', '', query).strip()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Start actor run
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

            # Poll for completion (max ~60s)
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

            # Get results
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
    html = await _zenrows_fetch(url)
    if not html:
        return {"store": "avito"}

    ld = _extract_json_ld(html)
    name = ld.get("name")
    price = ld.get("price")

    if not name:
        name = _extract_h1(html)

    if not name:
        og = _extract_og_title(html)
        if og:
            import html as html_lib
            name = html_lib.unescape(og)
            name = re.sub(r"\s*(?:купить|в\s+\w+).*$", "", name, flags=re.IGNORECASE).strip()
            name = re.sub(r"\s*[—–|]\s*(?:Объявление)?.*Авито.*$", "", name, flags=re.IGNORECASE).strip()

    if not price:
        for pat in [
            r'content="(\d+)"\s*itemprop="price"',
            r'itemprop="price"[^>]*content="(\d+)"',
            r'itemprop="price"[^>]*>(\d[\d\xa0\s]*\d)',
            r'data-marker="item-view/item-price"[^>]*>(\d[\d\xa0\s&;nbp]*\d)',
            r'"price":\s*\{[^}]*"value":\s*(\d+)',
            r'"price":\s*(\d{3,7})\b',
        ]:
            pm = re.search(pat, html)
            if pm:
                raw = pm.group(1).replace("\xa0", "").replace("&nbsp;", "")
                candidate = _clean_price(raw)
                if candidate and candidate > 50:
                    price = candidate
                    break

    # Clean up name
    if name:
        # Remove Avito-specific suffixes
        for suffix in ["Авито", "Avito", "Объявление"]:
            name = re.sub(rf"\s*[—–|]\s*(?:на\s+)?{suffix}.*$", "", name, flags=re.IGNORECASE).strip()

    return {"name": name, "price": price, "store": "avito"} if name else {"store": "avito"}


# ─── Generic (curl_cffi / httpx) ─────────────────────────────────────────────

async def _fetch_generic(url: str, store: str) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0",
        "Accept-Language": "ru-RU,ru;q=0.9",
    }
    html = None
    # Try curl_cffi first
    try:
        from curl_cffi.requests import AsyncSession
        async with AsyncSession() as session:
            resp = await session.get(url, headers=headers, impersonate="chrome124", timeout=15)
            if resp.status_code == 200:
                html = resp.text
    except Exception:
        pass
    # Fallback to httpx
    if not html:
        try:
            async with httpx.AsyncClient(timeout=12, headers=headers, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    html = resp.text
        except Exception:
            pass
    # Try ZenRows as last resort
    if not html:
        html = await _zenrows_fetch(url)

    if not html:
        return {"store": store if store != "unknown" else None}

    ld = _extract_json_ld(html)
    name = ld.get("name") or _extract_og_title(html) or _extract_h1(html)
    price = ld.get("price")

    if name:
        for suffix in ["Citilink", "М.Видео", "МегаМаркет", "Эльдорадо", "AliExpress"]:
            name = re.sub(rf"\s*[—–|]\s*{re.escape(suffix)}.*$", "", name, flags=re.IGNORECASE).strip()

    return {"name": name, "price": price, "store": store}


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
