import json
from crewai import Agent, Task, Crew, Process, LLM
from src.config import settings
from src.tools import theme_catalog_tool

llm = LLM(
    model=settings.llm_config["model"],
    base_url=settings.llm_config["base_url"],
    api_key=settings.llm_config["api_key"],
    temperature=0.2,
    **settings.llm_config["extra_kwargs"]
)

def run_theme_builder(brand_profile: dict, logo_url: str) -> dict:
    """
    Recommends a theme from the allowed catalog and builds the visual theme configurations.
    """
    theme_recommendation_agent = Agent(
        role="Especialista en Experiencia de Usuario y UI",
        goal="Seleccionar el mejor nombre de plantilla (template_name) del catálogo permitido para el perfil {brand_profile}",
        backstory="Un experto en conversión y psicología del consumidor que sabe exactamente qué diseño le sirve mejor a cada nicho.",
        tools=[theme_catalog_tool],
        llm=llm,
        verbose=True
    )

    ux_ui_expert_agent = Agent(
        role="Experto en Accesibilidad y Estética UX/UI",
        goal="Diseñar una paleta de colores premium y combinaciones de tipografías legibles y de alto impacto emocional para {brand_profile}",
        backstory="Un diseñador de interfaces galardonado, especializado en accesibilidad WCAG y paletas cromáticas armónicas que elevan la percepción de marca.",
        llm=llm,
        verbose=True
    )

    theme_builder_agent = Agent(
        role="Diseñador Frontend Senior",
        goal="Construir la especificación completa del tema basándose en la recomendación de diseño UX/UI y en la identidad visual de la marca.",
        backstory="Ingeniero frontend de UI obsesionado con el pixel-perfect, que organiza colores, tipografías e imágenes en configuraciones limpias.",
        llm=llm,
        verbose=True
    )

    task_recommend_theme = Task(
        description=(
            "Evalúa el perfil de marca: {brand_profile}.\n"
            "Consulta el catálogo de temas permitido usando 'Theme Catalog Tool'.\n"
            "Selecciona el tema óptimo. Los agentes NO pueden inventar temas que no estén en el catálogo."
        ),
        expected_output="JSON que contenga: template_name, confidence",
        agent=theme_recommendation_agent
    )

    task_design_ux_ui = Task(
        description=(
            "A partir de la plantilla recomendada y el perfil de marca {brand_profile}, diseña la paleta cromática completa.\n"
            "Define valores premium para: primary_color, secondary_color, accent_color, background_color (fondo base), surface_color (fondo de tarjetas/menús), surface_hover_color, y text_color.\n"
            "Asegúrate de que haya excelente contraste entre el texto y el fondo para cumplir con los estándares WCAG."
        ),
        expected_output="Un reporte detallado con las especificaciones de colores hex y tipografías recomendadas.",
        agent=ux_ui_expert_agent
    )

    task_build_theme = Task(
        description=(
            "Usa la plantilla seleccionada, el diseño del experto de UX/UI y el perfil de marca {brand_profile} para generar la especificación visual final.\n"
            "Asegúrate de incluir todos los campos del tema de forma estructurada, incluyendo colores avanzados para el fondo de la página, tarjetas y textos.\n"
            "El logo de la compañía es: '{logo_url}'."
        ),
        expected_output=(
            "JSON válido con los campos: template_name, primary_color, secondary_color, accent_color, heading_font, body_font, logo_url, "
            "background_color, surface_color, surface_hover_color, text_color"
        ),
        agent=theme_builder_agent
    )

    crew = Crew(
        agents=[theme_recommendation_agent, ux_ui_expert_agent, theme_builder_agent],
        tasks=[task_recommend_theme, task_design_ux_ui, task_build_theme],
        process=Process.sequential,
        verbose=True
    )

    from src.llm_balancer import execute_crew_with_retry

    result_str = execute_crew_with_retry(
        crew_instance=crew,
        llm_instance=llm,
        task_label="Theme Crew",
        inputs={
            "brand_profile": brand_profile,
            "logo_url": logo_url or ""
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
        # Fallback using brand profile colors and maternity/default template name
        return {
            "template_name": brand_profile.get("industry", "default"),
            "primary_color": brand_profile.get("primary_color", "#1A1A1A"),
            "secondary_color": brand_profile.get("secondary_color", "#F5F5F7"),
            "accent_color": brand_profile.get("accent_color", "#D2A26B"),
            "heading_font": brand_profile.get("heading_font", "Inter"),
            "body_font": brand_profile.get("body_font", "Inter"),
            "logo_url": logo_url or "",
            "background_color": "#0b0f19",
            "surface_color": "#131c2e",
            "surface_hover_color": "#1b263f",
            "text_color": "#f3f4f6"
        }
