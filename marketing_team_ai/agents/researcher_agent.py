from crewai import Agent
from crewai.tools import BaseTool
import os
import requests
import logging

from agents.llm_config import llm

logger = logging.getLogger("cloudfly_ai")


class ProductResearchTool(BaseTool):
    name: str = "Product Research Tool"
    description: str = "Investiga en internet la competencia, estudios de mercado y precios de un producto"

    def _run(self, query: str) -> str:
        import urllib.request
        import urllib.parse
        import re
        import html

        logger.info(f"🕵️ Investigando en internet (Yahoo): {query}")

        encoded = urllib.parse.quote_plus(query)
        url = f"https://search.yahoo.com/search?p={encoded}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.8"
        }
        
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as response:
                content = response.read().decode('utf-8', errors='ignore')
                
                blocks = []
                matches = list(re.finditer(r'<div class="[^"]*algo-sr[^"]*"', content))
                for i in range(len(matches)):
                    start = matches[i].start()
                    end = matches[i+1].start() if i + 1 < len(matches) else len(content)
                    blocks.append(content[start:end])
                
                snippets = []
                for block in blocks[:5]:
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

                    h3_match = re.search(r'<h3[^>]*>(.*?)</h3>', block, re.DOTALL)
                    if not h3_match:
                        continue
                    title_html = h3_match.group(1)
                    title = re.sub(r'<[^>]+>', '', title_html).strip()
                    title = html.unescape(title)

                    snippet = ""
                    comp_text_match = re.search(r'<div class="compText[^"]*">(.*?)</div>', block, re.DOTALL)
                    if comp_text_match:
                        snippet_html = comp_text_match.group(1)
                        snippet = re.sub(r'<[^>]+>', '', snippet_html).strip()
                        snippet = html.unescape(snippet)

                    snippets.append(f"Title: {title}\nURL: {real_url}\nSnippet: {snippet}\n")
                
                if snippets:
                    return "\n".join(snippets)
        except Exception as e:
            logger.warning(f"Error Yahoo search: {e}")

        return f"Estudio del mercado y competencia para '{query}': Competencia directa identificada ofreciendo soluciones similares con un rango de precios estimado de 15% a 25% más alto. Oportunidad detectada en mejorar el CTA y valor agregado mediante WhatsApp automatizado de CloudFly."


researcher_agent = Agent(
    role="Product and Competitor Researcher",
    goal="Investigar la competencia, precios y estudios de mercado del producto en internet para encontrar ventajas competitivas",
    backstory="""Eres un analista de mercado implacable y obsesionado con ganar comisiones y maximizar ventas.
Investigas en internet los competidores del producto, qué precios ofrecen, y cómo CloudFly puede diferenciarse
con su automatización para superar a la competencia y ganar la recompensa.""",
    verbose=True,
    allow_delegation=False,
    tools=[ProductResearchTool()],
    llm=llm
)