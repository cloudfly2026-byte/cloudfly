import json
from crewai import Agent, Task, Crew, Process, LLM
from src.config import settings

llm = LLM(
    model=settings.llm_config["model"],
    base_url=settings.llm_config["base_url"],
    api_key=settings.llm_config["api_key"],
    temperature=0.3,
    **settings.llm_config["extra_kwargs"]
)

def run_content_generator(company_name: str, company_description: str, brand_profile: dict, layout_structure: dict) -> dict:
    """
    Generates structured copy (hero titles, descriptions, SEO metadata) matching layout blocks.
    """
    copywriter_agent = Agent(
        role="Redactor Creativo y Especialista SEO",
        goal="Generar los textos publicitarios y metadatos SEO óptimos para las secciones de la tienda de {company_name}",
        backstory="Redactor con amplia experiencia en e-commerce y optimización para buscadores (SEO). Crea copys atractivos y persuasivos.",
        llm=llm,
        verbose=True
    )

    task_generate_content = Task(
        description=(
            "Genera textos iniciales publicitarios, copys y metadatos para la tienda de '{company_name}'.\n"
            "Usa la descripción de la compañía: '{company_description}' y perfil de marca {brand_profile}.\n"
            "Debes estructurar el contenido en JSON adaptándote a los bloques definidos en el layout {layout_structure}.\n"
            "Genera textos específicos para los bloques:\n"
            "- hero (con: hero_title, hero_subtitle, cta_text)\n"
            "- benefits (con una lista de 3 beneficios principales de la marca)\n"
            "- newsletter (con título e invitación a suscribirse)\n"
            "Agrega metadatos SEO globales: meta_title, meta_description, keywords."
        ),
        expected_output=(
            "JSON válido con los campos: hero, benefits, newsletter, seo (meta_title, meta_description, keywords)"
        ),
        agent=copywriter_agent
    )

    crew = Crew(
        agents=[copywriter_agent],
        tasks=[task_generate_content],
        process=Process.sequential,
        verbose=True
    )

    from src.llm_balancer import execute_crew_with_retry

    result_str = execute_crew_with_retry(
        crew_instance=crew,
        llm_instance=llm,
        task_label="Content Crew",
        inputs={
            "company_name": company_name,
            "company_description": company_description or "",
            "brand_profile": brand_profile,
            "layout_structure": layout_structure
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
        # Fallback copy structure if parsing fails
        return {
            "hero": {
                "hero_title": f"¡Bienvenidos a {company_name}!",
                "hero_subtitle": company_description or "Los mejores productos seleccionados para ti.",
                "cta_text": "Comprar ahora"
            },
            "benefits": [
                {"title": "Envío Rápido", "desc": "Entregas en tiempo récord a tu puerta."},
                {"title": "Calidad Garantizada", "desc": "Productos premium seleccionados rigurosamente."},
                {"title": "Soporte 24/7", "desc": "Atención personalizada en cualquier momento."}
            ],
            "newsletter": {
                "title": "Únete a nuestro Club",
                "desc": "Recibe ofertas exclusivas y novedades antes que nadie."
            },
            "seo": {
                "meta_title": f"{company_name} | Tienda en Línea Oficial",
                "meta_description": company_description or f"Encuentra los mejores productos y ofertas exclusivas en {company_name}.",
                "keywords": f"{company_name}, e-commerce, compras en línea"
            }
        }
