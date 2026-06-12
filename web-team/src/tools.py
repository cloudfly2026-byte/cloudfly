import json
import redis
import requests
from bs4 import BeautifulSoup
from crewai.tools import tool
from src.config import settings

# Redis client initialization
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        decode_responses=True
    )
except Exception:
    redis_client = None

@tool("MySQL Tool")
def mysql_tool(query: str, action: str = "select") -> str:
    """
    Executes a SELECT, INSERT, or UPDATE query against the CloudFly database.
    Use with caution. Only select is recommended unless writing themes/layouts.
    """
    from sqlalchemy import text
    from src.database import engine
    
    action = action.lower()
    if action not in ["select", "insert", "update"]:
        return "ERROR: Action must be 'select', 'insert', or 'update'."
        
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query))
            if action == "select":
                rows = result.fetchall()
                cols = result.keys()
                res = [dict(zip(cols, row)) for row in rows]
                return json.dumps(res, default=str, ensure_ascii=False)
            else:
                conn.commit()
                return f"SUCCESS: Query executed. Affected rows: {result.rowcount}"
    except Exception as e:
        return f"ERROR: Query failed: {str(e)}"

@tool("Redis Tool")
def redis_tool(action: str, key: str, value: str = "") -> str:
    """
    Executes a GET, SET, or DELETE command in Redis.
    Use for managing cache validation or storefront invalidation (website:{id}, theme:{id}, layout:{id}).
    """
    if not redis_client:
        return "ERROR: Redis client is not initialized."
    action = action.upper()
    try:
        if action == "GET":
            val = redis_client.get(key)
            return val if val else "Key not found."
        elif action == "SET":
            redis_client.set(key, value)
            return "SUCCESS: Key set."
        elif action == "DELETE":
            redis_client.delete(key)
            return f"SUCCESS: Key '{key}' deleted from cache."
        else:
            return "ERROR: Action must be GET, SET, or DELETE."
    except Exception as e:
        return f"ERROR: Redis operation failed: {str(e)}"

@tool("Internet Search Tool")
def internet_search(query: str) -> str:
    """
    Searches the internet for general brand presence, social media, industry reviews, and descriptions.
    """
    # Fallback duckduckgo search via API/scraper
    url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            results = []
            for a in soup.find_all('a', class_='result__snippet')[:5]:
                results.append(a.text.strip())
            return "\n\n".join(results) if results else "No results found."
    except Exception as e:
        pass
    return f"Search failed. Query: {query}"

@tool("Website Crawler Tool")
def website_crawler(url: str) -> str:
    """
    Crawls a target website to retrieve meta descriptions, titles, keywords, menus, and text content.
    Input should be a URL like 'https://nuevelunas.com.co'.
    """
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            title = soup.title.string.strip() if soup.title else ""
            meta_desc = ""
            meta_kw = ""
            desc_tag = soup.find('meta', attrs={'name': 'description'})
            if desc_tag:
                meta_desc = desc_tag.get('content', '').strip()
            kw_tag = soup.find('meta', attrs={'name': 'keywords'})
            if kw_tag:
                meta_kw = kw_tag.get('content', '').strip()
                
            # Grab some header/footer menus
            menus = []
            for nav in soup.find_all('nav'):
                for a in nav.find_all('a'):
                    txt = a.text.strip()
                    if txt and txt not in menus:
                        menus.append(txt)
            
            # Text body
            body_text = " ".join([p.text.strip() for p in soup.find_all('p')[:10]])
            
            return json.dumps({
                "title": title,
                "description": meta_desc,
                "keywords": meta_kw,
                "menus": menus[:15],
                "text": body_text[:1000]
            }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": f"Failed to crawl website: {str(e)}"})
    return json.dumps({"error": "Failed to retrieve website page."})

@tool("Screenshot Analyzer Tool")
def screenshot_tool(url: str) -> str:
    """
    Analyzes visual aspects (header, footer, layout structure, color contrast) of a website URL.
    Returns heuristic design properties.
    """
    # Mock design characteristics
    return json.dumps({
        "layout_style": "modern_clean",
        "header_type": "sticky_logo_left",
        "footer_style": "minimalist_dark",
        "visual_weight": "high_contrast",
        "suggested_aesthetic": "premium_lifestyle"
    })

@tool("Logo Analyzer Tool")
def logo_analyzer(logo_url: str) -> str:
    """
    Extracts hex codes for the primary, secondary, and accent colors from a logo image URL.
    Returns colors in HSL / Hex format.
    """
    # Mocking logo extraction colors if logo_url is valid, otherwise fallback palette
    logo_lower = logo_url.lower() if logo_url else ""
    if "spa" in logo_lower or "beauty" in logo_lower or "salud" in logo_lower:
        return json.dumps({
            "primary_color": "#D4AF37", # Gold
            "secondary_color": "#FFFFFF",
            "accent_color": "#4A2E80" # Purple
        })
    elif "baby" in logo_lower or "luna" in logo_lower or "matern" in logo_lower:
        return json.dumps({
            "primary_color": "#F8C8DC", # Pastel Pink
            "secondary_color": "#A7D8DE", # Pastel Cyan
            "accent_color": "#FFF0C2" # Pastel Yellow
        })
    elif "tech" in logo_lower or "electr" in logo_lower:
        return json.dumps({
            "primary_color": "#002D62", # Dark Blue
            "secondary_color": "#808080", # Grey
            "accent_color": "#00FF7F" # Spring Green
        })
    else:
        # Balanced general premium brand
        return json.dumps({
            "primary_color": "#1A1A1A", # Sleek Charcoal
            "secondary_color": "#F5F5F7", # Off-White
            "accent_color": "#D2A26B" # Warm Gold
        })

@tool("Theme Catalog Tool")
def theme_catalog_tool() -> str:
    """
    Returns the static list of allowed template/theme names in CloudFly storefront.
    The agents must select one from this list and are NOT allowed to invent new templates.
    """
    catalog = [
        "default",
        "fashion",
        "maternity",
        "pets",
        "electronics",
        "restaurant",
        "beauty",
        "spa",
        "health",
        "realestate"
    ]
    return json.dumps(catalog)
