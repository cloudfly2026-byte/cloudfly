"""Shared LLM configuration for all marketing team agents."""

from crewai import LLM
import os

# Get default model, defaulting to OpenRouter Owl Alpha
model_default = os.getenv("MODEL_DEFAULT", "openrouter/owl-alpha")
openrouter_base = "https://openrouter.ai/api/v1"
openrouter_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")

if "/" in model_default:
    provider, model_name = model_default.split("/", 1)
else:
    provider = "openrouter"
    model_name = model_default

if provider == "openai":
    llm_model = model_name
    llm_base_url = "https://api.openai.com/v1"
    llm_api_key = os.getenv("OPENAI_API_KEY") or openrouter_key
elif provider == "groq":
    llm_model = f"groq/{model_name}"
    llm_base_url = openrouter_base
    llm_api_key = os.getenv("GROQ_API_KEY") or openrouter_key
else:
    # OpenRouter (default)
    llm_model = f"openrouter/{model_name}"
    llm_base_url = openrouter_base
    llm_api_key = openrouter_key

llm = LLM(
    model=llm_model,
    base_url=llm_base_url,
    api_key=llm_api_key,
    temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
)

