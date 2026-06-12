import os
import time
import json
import logging
import re
from typing import Any
from src.config import settings
from src.tools import redis_client

logger = logging.getLogger("cloudfly_ai.llm_balancer")

# Local in-memory cache of rate-limited keys
local_rate_limits = {}

def get_healthy_api_key(current_key=None, mark_rate_limited=False) -> str:
    global local_rate_limits
    now = time.time()
    
    # Clean quotes if any from keys
    def clean_key(val: str) -> str:
        return val.strip(' "\'') if val else ""

    keys = []
    # Try multiple environment variables to populate pool
    pool_str = os.getenv("OPENROUTER_KEYS_POOL") or os.getenv("SCRUM_TEAM_OPENROUTER_KEY") or os.getenv("OPENROUTER_API_KEY")
    if pool_str:
        keys = [clean_key(k) for k in pool_str.split(",") if k.strip(' "\'')]
        
    if mark_rate_limited and current_key:
        curr_clean = clean_key(current_key)
        local_rate_limits[curr_clean] = now + 43200  # 12 hours
        if redis_client:
            try:
                redis_client.set(f"scrum:rate_limit:{curr_clean}", "limited", ex=43200)
                logger.info(f"⚠️ [Balanceador]: Registrado rate limit para la clave ...{curr_clean[-8:]} en Redis.")
            except Exception as e:
                logger.warning(f"Error saving rate limit to Redis: {e}")

    if not keys:
        raw_key = clean_key(current_key) or clean_key(settings.OPENROUTER_API_KEY)
        return raw_key

    healthy_keys = []
    for k in keys:
        is_limited = False
        if k in local_rate_limits:
            if now < local_rate_limits[k]:
                is_limited = True
            else:
                del local_rate_limits[k]
                
        if not is_limited and redis_client:
            try:
                if redis_client.get(f"scrum:rate_limit:{k}"):
                    is_limited = True
            except Exception:
                pass
                
        if not is_limited:
            healthy_keys.append(k)

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

def get_healthiest_model() -> str:
    paths = [
        "/app/model_health_status.json",
        "C:/apps/cloudfly/web-team/model_health_status.json",
        "model_health_status.json",
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

def rotate_llm(llm_instance, current_key=None, mark_rate_limited=False):
    new_key = get_healthy_api_key(current_key=current_key, mark_rate_limited=mark_rate_limited)
    new_model = get_healthiest_model() 
    
    if "/" in new_model:
        provider, model_name = new_model.split("/", 1)
    else:
        provider = "openrouter"
        model_name = new_model

    extra_kwargs = {}
    if provider == "openai":
        llm_model = model_name
        llm_base_url = "https://api.openai.com/v1"
        llm_api_key = os.getenv("OPENAI_API_KEY") or new_key
    elif provider == "groq":
        llm_model = f"openai/{model_name}"
        llm_base_url = "https://openrouter.ai/api/v1"
        llm_api_key = os.getenv("GROQ_API_KEY") or new_key
    elif provider == "nvidia":
        llm_model = f"openai/{model_name}"
        llm_base_url = "https://integrate.api.nvidia.com/v1"
        llm_api_key = os.getenv("NVIDIA_API_KEY") or new_key
        extra_kwargs["extra_body"] = {"chat_template_kwargs": {"thinking": True}}
    else:
        # OpenRouter (default)
        llm_model = f"openai/{model_name}"
        llm_base_url = "https://openrouter.ai/api/v1"
        llm_api_key = new_key

    # Strip quotes if any
    if llm_api_key:
        llm_api_key = llm_api_key.strip(' "\'')

    logger.info(f"🔄 Rotando LLM: Modelo={llm_model}, Key=...{llm_api_key[-8:] if llm_api_key else 'None'}, Base={llm_base_url}")
    
    # Mutate the LLM instance attributes
    llm_instance.model = llm_model
    llm_instance.base_url = llm_base_url
    llm_instance.api_key = llm_api_key
    
    # Reset any existing extra kwargs or set nvidia specific ones
    if hasattr(llm_instance, "extra_body"):
        delattr(llm_instance, "extra_body")
    for k, v in extra_kwargs.items():
        setattr(llm_instance, k, v)
        
    if new_key:
        os.environ["OPENROUTER_API_KEY"] = new_key
        os.environ["OPENAI_API_KEY"] = new_key
        
    return new_key

def execute_crew_with_retry(crew_instance, llm_instance, task_label="Crew", max_retries=6, inputs=None) -> Any:
    retry_count = 0
    while retry_count < max_retries:
        try:
            current_key = os.environ.get("OPENROUTER_API_KEY")
            rotate_llm(llm_instance, current_key=current_key, mark_rate_limited=False)
            
            result = crew_instance.kickoff(inputs=inputs)
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
                    
                wait_time = 10
                match = re.search(r"(?:retry after|try again in|retry in|after)\s+([\d\.]+)\s*(?:s|second|seconds)", err_msg, re.IGNORECASE)
                if match:
                    try:
                        wait_time = float(match.group(1))
                        logger.info(f"⏳ [Retry Dynamic] Tiempo de espera de {wait_time}s sugerido por el proveedor.")
                    except ValueError:
                        pass
                else:
                    wait_time = 5 * (2 ** (retry_count - 1))
                    
                current_key = os.environ.get("OPENROUTER_API_KEY")
                logger.warning(f"⚠️ [{task_label} - Intento {retry_count}/{max_retries}]: Error LLM: {err_msg[:120]}")
                
                # Mark current model unhealthy and rotate key/model
                current_model = get_healthiest_model()
                try:
                    from src.model_health_worker import mark_model_unhealthy
                    mark_model_unhealthy(current_model, err_msg)
                except Exception as ex:
                    logger.warning(f"Could not mark model unhealthy: {ex}")
                
                rotate_llm(llm_instance, current_key=current_key, mark_rate_limited=True)
                
                logger.info(f"⏳ Esperando {wait_time} segundos antes de reintentar...")
                time.sleep(wait_time)
            else:
                raise e
