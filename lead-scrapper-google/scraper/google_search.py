import logging
from urllib.parse import unquote, urlparse

from playwright.sync_api import Page

from scraper.browser import dismiss_cookie_banner, goto, page_html
from scraper.config import (
    GOOGLE_TIMEOUT_MS,
    SKIP_EXTENSIONS,
    SKIP_HOST_EXACT,
    SKIP_NETLOC_FRAGMENTS,
)
from scraper.directory import is_directory

logger = logging.getLogger("lead_scraper.google")


def debe_saltar(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host in SKIP_HOST_EXACT:
        return True
    if any(d in host for d in SKIP_NETLOC_FRAGMENTS):
        return True
    path = parsed.path.lower()
    if any(path.endswith(ext) for ext in SKIP_EXTENSIONS):
        return True
    # Datasets / APIs abiertas
    if any(seg in path for seg in ("/dataset", "/datasets", "/api/", "/resource/")):
        return True
    return False


def prioritize_links(links: list[str]) -> list[str]:
    """Directorios primero para extraer muchos leads sin visitar cada web."""
    directories = [u for u in links if is_directory(u)]
    rest = [u for u in links if u not in directories]
    if directories:
        logger.info("Prioritized %s directory URLs before %s other links", len(directories), len(rest))
    return directories + rest


def collect_google_links(page: Page, query: str, pages: int, verbose: bool) -> list[str]:
    import urllib.request
    import urllib.parse
    import re
    import html
    import time
    import random

    links: list[str] = []
    seen: set[str] = set()

    for page_num in range(pages):
        start = page_num * 10
        b_param = start + 1
        search_url = f"https://search.yahoo.com/search?p={urllib.parse.quote_plus(query)}&b={b_param}"
        
        if verbose:
            print(f"\n🔍  Yahoo página {page_num + 1}: {search_url}")
        logger.info("Querying Yahoo search_url='%s'", search_url)

        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        ]
        ua = random.choice(user_agents)

        headers = {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3"
        }

        # Add a random delay to prevent rate-limiting (4.5 to 7.5 seconds)
        delay = random.uniform(4.5, 7.5)
        logger.info("Sleeping %.2f seconds before search query to avoid rate limits...", delay)
        time.sleep(delay)

        max_attempts = 3
        content = ""
        for attempt in range(max_attempts):
            try:
                req = urllib.request.Request(search_url, headers=headers)
                with urllib.request.urlopen(req, timeout=12) as response:
                    content = response.read().decode('utf-8', errors='ignore')
                    break
            except Exception as e:
                logger.warning("Attempt %s/%s failed querying Yahoo: %s", attempt + 1, max_attempts, e)
                if attempt < max_attempts - 1:
                    backoff = (attempt + 1) * 8.0 + random.uniform(2.0, 5.0)
                    logger.info("Retrying Yahoo search in %.2f seconds...", backoff)
                    time.sleep(backoff)
                else:
                    if verbose:
                        print(f"  ⚠️  Error persistente en Yahoo: {e}")

        if not content:
            continue

        try:
            blocks = []
            matches = list(re.finditer(r'<div class="[^"]*algo-sr[^"]*"', content))
            for i in range(len(matches)):
                start_idx = matches[i].start()
                end_idx = matches[i+1].start() if i + 1 < len(matches) else len(content)
                blocks.append(content[start_idx:end_idx])

            for block in blocks:
                link_match = re.search(r'href="([^"]+)"', block)
                if not link_match:
                    continue
                raw_url = link_match.group(1)
                real_url = raw_url
                if "/RU=" in raw_url:
                    parts = raw_url.split("/RU=")
                    if len(parts) > 1:
                        target = parts[1].split("/")[0]
                        real_url = urllib.parse.unquote(target)

                if "search.yahoo.com" in real_url:
                    continue
                if not real_url.startswith("http"):
                    continue
                if debe_saltar(real_url):
                    continue

                key = real_url.rstrip("/").lower()
                if key not in seen:
                    seen.add(key)
                    links.append(real_url)
        except Exception as e:
            logger.warning("Error parsing Yahoo page_num=%s: %s", page_num + 1, e)

    return prioritize_links(links)


def _extract_hrefs_from_html(html: str) -> list[str]:
    import re

    return re.findall(r'href=["\']([^"\']+)["\']', html, re.I)
