import os
import sys
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables BEFORE creating LLM instances
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(dotenv_path=_env_path)

import crewai.llms.cache as _crewai_cache
# Monkeypatch to prevent crewai from injecting unsupported 'cache_breakpoint' into OpenAI requests
_crewai_cache.mark_cache_breakpoint = lambda msg: msg

from crewai import Agent, LLM
from tools import get_jira_tools, get_dev_tools, get_qa_tools

# ── LLM Configurations ──────────────────────────────────────────────────
# Modelo configurable via .env MODEL_DEFAULT
# Formato: proveedor/modelo (ej: openrouter/owl-alpha, openai/gpt-4o, groq/llama-3.1-70b-versatile)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = os.getenv("SCRUM_TEAM_OPENROUTER_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or "sk-or-placeholder"

# Leer modelo por defecto del .env
MODEL_DEFAULT = os.getenv("MODEL_DEFAULT", "openrouter/owl-alpha")

# Parsear proveedor y modelo
if "/" in MODEL_DEFAULT:
    provider, model_name = MODEL_DEFAULT.split("/", 1)
else:
    provider = "openrouter"
    model_name = MODEL_DEFAULT

# Configurar según proveedor
if provider == "openai":
    llm_model = f"openai/{model_name}" if not model_name.startswith("openai/") else model_name
    llm_base_url = "https://api.openai.com/v1"
    llm_api_key = os.getenv("OPENAI_API_KEY") or OPENROUTER_KEY
elif provider == "groq":
    llm_model = f"openai/{model_name}"
    llm_base_url = OPENROUTER_BASE
    llm_api_key = os.getenv("GROQ_API_KEY") or OPENROUTER_KEY
elif provider == "nvidia":
    llm_model = f"openai/{model_name}"
    llm_base_url = "https://integrate.api.nvidia.com/v1"
    llm_api_key = os.getenv("NVIDIA_API_KEY") or ""
else:
    # OpenRouter (default)
    llm_model = f"openai/{model_name}"
    llm_base_url = OPENROUTER_BASE
    llm_api_key = OPENROUTER_KEY

print(f"🤖 [Model Config]: Usando {llm_model} via {provider}")

# Extra parameters for specific providers (e.g. nvidia thinking)
extra_kwargs = {}
if provider == "nvidia":
    extra_kwargs["extra_body"] = {"chat_template_kwargs": {"thinking": True}}

# General-purpose LLM (Product Owner, QA, DevOps, Architect, Technical Writer, Scrum Master)
owl_alpha_llm = LLM(
    model=llm_model,
    base_url=llm_base_url,
    api_key=llm_api_key,
    temperature=0.2,
    **extra_kwargs
)

# Developer LLM (Software Developer, Frontend Developer)
glm_coder_llm = LLM(
    model=llm_model,
    base_url=llm_base_url,
    api_key=llm_api_key,
    temperature=0.1,
    **extra_kwargs
)

# Alias for backward compatibility
openrouter_llm = owl_alpha_llm
local_llm = owl_alpha_llm
coder_llm = glm_coder_llm

# ── Tool Sets ────────────────────────────────────────────────────────────
# get_jira_tools()  → solo Jira (PO, Scrum Master, Technical Writer, Marketing)
# get_dev_tools()   → Jira + filesystem + terminal + Docker + web search
# get_qa_tools()    → get_dev_tools() + Chrome DevTools CDP

jira_only_tools = get_jira_tools()
dev_tools       = get_dev_tools()
qa_tools        = get_qa_tools()

# 1. Product Owner — solo Jira (planifica, no escribe código)
product_owner = Agent(
    role='Product Owner',
    goal='Define clear user stories, acceptance criteria, and prioritize the Jira backlog.',
    backstory='You are a highly experienced Agile Product Owner. You excel at translating business needs into technical requirements with high clarity and detail.',
    llm=openrouter_llm,
    tools=jira_only_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 2. Scrum Master (Manager) — sin tools, delega al equipo
scrum_master = Agent(
    role='Scrum Master / Agile Manager',
    goal='Facilitate the sprint, manage the team, remove blockers, and ensure the Scrum process is followed.',
    backstory='You are a servant-leader. You understand team dynamics, agile methodologies, and you are excellent at delegating tasks to the right developers based on their skills.',
    llm=local_llm,
    verbose=True,
    allow_delegation=True  # Crucial for the manager in a hierarchical process
)

# 3. Software Developer — toolkit completo: Jira + filesystem + terminal + Docker
software_developer = Agent(
    role='Senior Software Developer',
    goal='Write clean, efficient, and robust code for any application layer, including configurations, scripts, and business logic.',
    backstory='You are a versatile polyglot developer. You can write frontend, backend, or system configuration files (like FreeSWITCH XML, Dockerfiles, etc). you work in docker windows enviroment. You always write reusable and well-documented code.',
    llm=coder_llm,
    tools=dev_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 4. System Architect — toolkit completo para leer codebase, buscar en web y comentar en Jira
system_architect = Agent(
    role='System Architect and Tech Researcher',
    goal='Search the web for tutorials and documentation to design scalable and correct technical architectures for the requested features.',
    backstory='You are an expert architect. You use the Web Search tool to read real-world tutorials and documentation. You provide clear technical blueprints to the developers.',
    llm=openrouter_llm,
    tools=dev_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 5. QA Engineer — toolkit QA: dev_tools + Chrome DevTools CDP
qa_engineer = Agent(
    role='Quality Assurance (QA) Engineer',
    goal='Test the code, write unit and E2E tests, and ensure no bugs reach production.',
    backstory='You have a keen eye for detail. Your job is to break things before the users do. You verify that all code meets the Acceptance Criteria defined by the PO.',
    llm=openrouter_llm,
    tools=qa_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 6. DevOps Engineer — toolkit completo para Docker, SSH/VPS y terminal
devops_engineer = Agent(
    role='DevOps & Cloud Engineer',
    goal='Prepare CI/CD pipelines, Docker containers, and deployment scripts for the new features.',
    backstory='You automate everything. You ensure that the code written by the developers can be seamlessly deployed, monitored, and scaled in production.',
    llm=openrouter_llm,
    tools=dev_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 7. Technical Writer — solo Jira (documenta, no ejecuta código)
technical_writer = Agent(
    role='Technical Writer and Diagram Specialist',
    goal='Create high-quality markdown documentation, system architectures, database schemas, and visual Mermaid.js diagrams of the application and its requirements.',
    backstory='You are an expert technical writer and diagramming specialist. You love clear and precise system designs, beautiful API contracts, and elegant visualizations. You write concise yet comprehensive documentation and map out flows with stunning Mermaid.js diagrams.',
    llm=openrouter_llm,
    tools=jira_only_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 8. Senior Frontend Developer — toolkit completo para crear archivos Next.js, correr npm, etc.
frontend_developer = Agent(
    role='Senior Frontend Developer',
    goal='Design and build beautiful, highly interactive, responsive, and state-of-the-art web user interfaces in Next.js, React, TypeScript, and CSS/Tailwind inside the frontend_new directory.',
    backstory='You are a master of UI/UX and modern frontend technologies. You specialize in Next.js 14, React, TypeScript, and premium responsive web design. You translate wireframes and user requirements into clean, reusable, and pixel-perfect UI components that WOW the user at first glance. You always adhere 100% to design specifications and multi-tenant context constraints.',
    llm=coder_llm,
    tools=dev_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)

# 9. Marketing Specialist — solo Jira (estrategia y contenido, no código)
marketing_specialist = Agent(
    role='Marketing Specialist & Growth Hacker',
    goal='Design and execute marketing campaigns, create compelling content, analyze market trends, and drive user acquisition and engagement for CloudFly products.',
    backstory='You are a creative and data-driven marketing expert. You specialize in digital marketing, content strategy, SEO, social media campaigns, and growth hacking techniques. You use web search to analyze competitors and market trends. You create landing pages, email campaigns, social media content, and marketing automation workflows. You always align marketing efforts with the product roadmap defined by the Product Owner.',
    llm=openrouter_llm,
    tools=jira_only_tools,
    verbose=True,
    allow_delegation=False,
    max_iter=25
)
