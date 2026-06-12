import json
from crewai import Agent, Task, Crew, Process, LLM
from src.config import settings
from src.tools import internet_search, website_crawler, screenshot_tool, logo_analyzer
from src.llm_balancer import execute_crew_with_retry

llm = LLM(
    model=settings.llm_config["model"],
    base_url=settings.llm_config["base_url"],
    api_key=settings.llm_config["api_key"],
    temperature=0.2,
    **settings.llm_config["extra_kwargs"]
)

def run_brand_discovery(company_name: str, company_description: str, website_url: str, logo_url: str) -> dict:
    """
    Runs the Brand Discovery Crew to identify industry, subindustry, tone, style, primary/secondary/accent colors,
    and heading/body typography.
    """
    company_discovery_agent = Agent(
        role="Investigador de Mercado y Compañías",
        goal="Recolectar toda la información de marca, industria y presencia digital de la compañía {company_name}",
        backstory="Un detective digital experto en buscar empresas en internet, analizar su presencia en redes y categorizar su industria.",
        tools=[internet_search, website_crawler],
        llm=llm,
        verbose=True
    )

    brand_identity_agent = Agent(
        role="Director de Identidad de Marca y Visual",
        goal="Descubrir y estructurar la identidad visual (colores, fuentes y estilo) de {company_name}",
        backstory="Diseñador de marca de clase mundial capaz de traducir descripciones y logotipos en paletas de colores armónicas y tipografías premium.",
        tools=[screenshot_tool, logo_analyzer],
        llm=llm,
        verbose=True
    )

    task_company_discovery = Task(
        description=(
            "Investiga a la compañía '{company_name}' usando su descripción: '{company_description}'.\n"
            "Si tiene un sitio web '{website_url}', usa el crawler para obtener sus palabras clave, menús y textos.\n"
            "Determina su industria principal, subindustria y observaciones del negocio."
        ),
        expected_output="JSON que contiene: company_name, industry, subindustry, website, summary",
        agent=company_discovery_agent
    )

    task_brand_identity = Task(
        description=(
            "Analiza el logo '{logo_url}' y la información investigada para definir la identidad de marca.\n"
            "Elige un tono (ej: warm, professional, bold), estilo (ej: premium, minimalist, playful),\n"
            "tres colores en formato Hex (primary_color, secondary_color, accent_color), y fuentes tipográficas premium de Google Fonts (heading_font, body_font)."
        ),
        expected_output=(
            "JSON válido con los campos: industry, subindustry, tone, style, primary_color, secondary_color, accent_color, heading_font, body_font"
        ),
        agent=brand_identity_agent
    )

    crew = Crew(
        agents=[company_discovery_agent, brand_identity_agent],
        tasks=[task_company_discovery, task_brand_identity],
        process=Process.sequential,
        verbose=True
    )

    result_str = execute_crew_with_retry(
        crew_instance=crew,
        llm_instance=llm,
        task_label="Brand Discovery Crew",
        inputs={
            "company_name": company_name,
            "company_description": company_description or "",
            "website_url": website_url or "",
            "logo_url": logo_url or ""
        }
    )

    # Safely parse JSON result from LLM output
    try:
        # Strip code block wrappers if any
        raw = str(result_str).strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.endswith("```"):
            raw = raw[:-3]
        return json.loads(raw.strip())
    except Exception:
        # Return fallback balanced visual identity if parsing fails
        return {
            "industry": "default",
            "subindustry": "general",
            "tone": "professional",
            "style": "premium",
            "primary_color": "#1A1A1A",
            "secondary_color": "#F5F5F7",
            "accent_color": "#D2A26B",
            "heading_font": "Inter",
            "body_font": "Inter"
        }
