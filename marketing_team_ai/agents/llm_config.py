"""Shared LLM configuration for all marketing team agents."""

from crewai import LLM
import os
import json
import logging
import time
from tools.redis_tool import RedisTool

logger = logging.getLogger("cloudfly_ai.llm_config")

# Local in-memory cache of rate-limited keys
local_rate_limits = {}

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

def get_healthy_api_key(current_key=None, mark_rate_limited=False):
    global local_rate_limits
    if current_key:
        current_key = current_key.strip(' "\'')
    keys = []
    pool_str = os.getenv("OPENROUTER_KEYS_POOL") or os.getenv("OPENROUTER_API_KEY")
    if pool_str:
        keys = [k.strip(' "\'') for k in pool_str.split(",") if k.strip(' "\'')]
    
    if not keys:
        raw_key = current_key or os.getenv("OPENROUTER_API_KEY")
        return raw_key.strip(' "\'') if raw_key else None

    now = time.time()
    
    if mark_rate_limited and current_key:
        expiry = now + 43200  # 12 hours
        local_rate_limits[current_key] = expiry
        try:
            r = RedisTool.get_client()
            r.set(f"scrum:rate_limit:{current_key}", "limited", ex=43200)
            logger.info(f"⚠️ [Balanceador]: Registrado rate limit para la clave ...{current_key[-8:]} en Redis.")
        except Exception as e:
            logger.warning(f"⚠️ [Balanceador - Standalone]: Registrado rate limit para la clave ...{current_key[-8:]} en memoria local. ({e})")

    healthy_keys = []
    logger.info(f"🔍 [Balanceador] Evaluando {len(keys)} claves del pool.")
    for k in keys:
        is_limited = False
        reason = ""
        if k in local_rate_limits:
            if now < local_rate_limits[k]:
                is_limited = True
                reason = "local_rate_limit"
            else:
                del local_rate_limits[k]
        
        if not is_limited:
            try:
                r = RedisTool.get_client()
                if r.get(f"scrum:rate_limit:{k}"):
                    is_limited = True
                    reason = "redis_rate_limit"
            except Exception as e:
                logger.warning(f"Error checking Redis for key: {e}")
                pass
        
        logger.info(f"  - Clave ...{k[-8:]}: {'LIMITADA ('+reason+')' if is_limited else 'SALUDABLE'}")
        if not is_limited:
            healthy_keys.append(k)

    logger.info(f"🔍 [Balanceador] Claves saludables encontradas: {[k[-8:] for k in healthy_keys]}")
    if not healthy_keys:
        logger.warning("🚨 [Balanceador] ADVERTENCIA: Todas las claves del pool han alcanzado su límite. Reseteando límites locales.")
        local_rate_limits.clear()
        return keys[0]

    if current_key in healthy_keys and not mark_rate_limited:
        return current_key
    
    if current_key in healthy_keys:
        idx = (healthy_keys.index(current_key) + 1) % len(healthy_keys)
        return healthy_keys[idx]
    return healthy_keys[0]

def get_healthiest_model():
    paths = [
        "C:/apps/cloudfly/ai_scrum_team/model_health_status.json",
        "/apps/cloudfly/ai_scrum_team/model_health_status.json",
        "../ai_scrum_team/model_health_status.json"
    ]
    for status_path in paths:
        if os.path.exists(status_path):
            try:
                with open(status_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    model = data.get("healthiest_model")
                    if model:
                        return model
            except Exception:
                pass
    return os.getenv("MODEL_DEFAULT", "openrouter/owl-alpha")

def rotate_llm_config(current_key=None, mark_rate_limited=False):
    new_key = get_healthy_api_key(current_key=current_key, mark_rate_limited=mark_rate_limited)
    new_model = get_healthiest_model()
    
    if "/" in new_model:
        provider, model_name = new_model.split("/", 1)
    else:
        provider = "openrouter"
        model_name = new_model
        
    if provider == "openai":
        llm_model = model_name
        llm_base_url = "https://api.openai.com/v1"
        llm_api_key = os.getenv("OPENAI_API_KEY") or new_key
    elif provider == "groq":
        llm_model = f"groq/{model_name}"
        llm_base_url = "https://openrouter.ai/api/v1"
        llm_api_key = os.getenv("GROQ_API_KEY") or new_key
    else:
        llm_model = f"openrouter/{model_name}"
        llm_base_url = "https://openrouter.ai/api/v1"
        llm_api_key = new_key

    logger.info(f"🔄 Rotando LLM: Modelo={llm_model}, Key=...{llm_api_key[-8:] if llm_api_key else 'None'}")
    
    llm.model = llm_model
    llm.base_url = llm_base_url
    llm.api_key = llm_api_key
    
    if new_key:
        os.environ["OPENROUTER_API_KEY"] = new_key
        os.environ["OPENAI_API_KEY"] = new_key
    
    return new_key

def execute_crew_with_retry(crew_instance, task_label="Crew", max_retries=6):
    retry_count = 0
    while retry_count < max_retries:
        try:
            current_key = os.environ.get("OPENROUTER_API_KEY")
            rotate_llm_config(current_key=current_key, mark_rate_limited=False)
            
            result = crew_instance.kickoff()
            return result
        except Exception as e:
            err_msg = str(e)
            retryable = (
                "429" in err_msg
                or "rate limit" in err_msg.lower()
                or "Invalid response from LLM call" in err_msg
                or "None or empty" in err_msg
                or "401" in err_msg
                or "unauthorized" in err_msg.lower()
            )
            if retryable:
                retry_count += 1
                if retry_count >= max_retries:
                    raise e
                
                # Intentar extraer dinámicamente el tiempo de espera recomendado (Retry-After)
                # ej. "try again in 15s" o "Please retry after 4.2 seconds"
                wait_time = 10  # Fallback por defecto
                import re
                match = re.search(r"(?:retry after|try again in|retry in|after)\s+([\d\.]+)\s*(?:s|second|seconds)", err_msg, re.IGNORECASE)
                if match:
                    try:
                        wait_time = float(match.group(1))
                        logger.info(f"⏳ [Retry Dynamic] Detectado tiempo de espera sugerido de {wait_time}s por el proveedor.")
                    except ValueError:
                        pass
                else:
                    # Aplicar exponential backoff si no viene indicado por la API
                    wait_time = 5 * (2 ** (retry_count - 1))
                
                current_key = os.environ.get("OPENROUTER_API_KEY")
                logger.warning(f"⚠️ [{task_label} - Intento {retry_count}/{max_retries}]: Error LLM: {err_msg[:120]}")
                rotate_llm_config(current_key=current_key, mark_rate_limited=True)
                
                logger.info(f"⏳ Esperando {wait_time} segundos antes de reintentar...")
                time.sleep(wait_time)
            else:
                raise e



