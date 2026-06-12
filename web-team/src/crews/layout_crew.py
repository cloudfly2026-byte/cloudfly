import json
from crewai import Agent, Task, Crew, Process, LLM
from src.config import settings

llm = LLM(
    model=settings.llm_config["model"],
    base_url=settings.llm_config["base_url"],
    api_key=settings.llm_config["api_key"],
    temperature=0.2,
    **settings.llm_config["extra_kwargs"]
)

def run_layout_builder(template_name: str, brand_profile: dict) -> dict:
    """
    Constructs layouts (blocks/grids) for pages (home, category, product).
    """
    layout_designer_agent = Agent(
        role="Diseñador de Estructuras y Wireframes Web",
        goal="Generar y estructurar la jerarquía de bloques óptimos para las páginas 'home', 'category' y 'product'.",
        backstory="Un estratega de conversión digital enfocado en estructurar páginas web de comercio electrónico mediante bloques lógicos.",
        llm=llm,
        verbose=True
    )

    task_build_layout = Task(
        description=(
            "Construye la estructura de bloques que componen el sitio web para la plantilla '{template_name}' con perfil {brand_profile}.\n"
            "Define la lista ordenada de bloques de componentes para 3 páginas:\n"
            "- 'home': debe usar bloques como 'hero', 'categories', 'featured_products', 'benefits', 'newsletter'.\n"
            "- 'category': debe usar bloques como 'category_header', 'product_grid', 'filters'.\n"
            "- 'product': debe usar bloques como 'product_gallery', 'product_details', 'related_products'.\n"
            "Retorna un JSON estructurado que contenga las 3 llaves de página."
        ),
        expected_output=(
            "JSON válido con el formato: \n"
            "{\n"
            "  \"home\": { \"blocks\": [\"hero\", \"categories\", \"featured_products\", \"benefits\", \"newsletter\"] },\n"
            "  \"category\": { \"blocks\": [\"category_header\", \"product_grid\", \"filters\"] },\n"
            "  \"product\": { \"blocks\": [\"product_gallery\", \"product_details\", \"related_products\"] }\n"
            "}"
        ),
        agent=layout_designer_agent
    )

    crew = Crew(
        agents=[layout_designer_agent],
        tasks=[task_build_layout],
        process=Process.sequential,
        verbose=True
    )

    from src.llm_balancer import execute_crew_with_retry

    result_str = execute_crew_with_retry(
        crew_instance=crew,
        llm_instance=llm,
        task_label="Layout Crew",
        inputs={
            "template_name": template_name,
            "brand_profile": brand_profile
        }
    )

    try:
        raw = str(result_str).strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.endswith("```"):
            raw = raw[:-3]
        return json.loads(raw.strip())
    except Exception:
        # Fallback default structures if parsing fails
        return {
            "home": { "blocks": ["hero", "categories", "featured_products", "benefits", "newsletter"] },
            "category": { "blocks": ["category_header", "product_grid", "filters"] },
            "product": { "blocks": ["product_gallery", "product_details", "related_products"] }
        }
