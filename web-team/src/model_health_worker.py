import os
import sys
import json
import time
import requests
import logging
from datetime import datetime

logger = logging.getLogger("cloudfly_ai.model_health_worker")

# Force UTF-8 encoding for Windows terminals to support emojis
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Path references
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# STATUS_PATH can be local to the web-team app
STATUS_PATH = os.path.join(BASE_DIR, "..", "model_health_status.json")

# ── Active Models ───────────────────────────────────────────────────────
MODEL_DEFAULT = os.getenv("MODEL_DEFAULT", "openrouter/owl-alpha")

# Parse provider and model
if "/" in MODEL_DEFAULT:
    _provider, _model_name = MODEL_DEFAULT.split("/", 1)
else:
    _provider = "openrouter"
    _model_name = MODEL_DEFAULT

# Configure according to provider
if _provider == "openai":
    HEALTH_API_BASE = "https://api.openai.com/v1"
    HEALTH_API_KEY = os.getenv("OPENAI_API_KEY") or ""
    CANDIDATE_MODELS = [MODEL_DEFAULT, "gpt-4o-mini", "gpt-4o"]
    DEFAULT_MODEL = MODEL_DEFAULT
elif _provider == "groq":
    HEALTH_API_BASE = "https://api.groq.com/openai/v1"
    HEALTH_API_KEY = os.getenv("GROQ_API_KEY") or ""
    CANDIDATE_MODELS = [MODEL_DEFAULT, "llama3-70b-8192", "mixtral-8x7b-32768"]
    DEFAULT_MODEL = MODEL_DEFAULT
elif _provider == "nvidia":
    HEALTH_API_BASE = "https://integrate.api.nvidia.com/v1"
    HEALTH_API_KEY = os.getenv("NVIDIA_API_KEY") or ""
    CANDIDATE_MODELS = [
        MODEL_DEFAULT,
        "openrouter/owl-alpha",
        "google/gemini-2.5-flash",
        "anthropic/claude-3-haiku"
    ]
    DEFAULT_MODEL = MODEL_DEFAULT
else:
    # OpenRouter (default)
    HEALTH_API_BASE = "https://openrouter.ai/api/v1"
    HEALTH_API_KEY = os.getenv("SCRUM_TEAM_OPENROUTER_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
    CANDIDATE_MODELS = [
        MODEL_DEFAULT,
        "meta-llama/llama-3-70b-instruct",
        "google/gemini-2.5-flash",
        "anthropic/claude-3-haiku"
    ]
    DEFAULT_MODEL = MODEL_DEFAULT

logger.info(f"🤖 [Health Worker]: Modelo configurado: {DEFAULT_MODEL} via {_provider}")


def get_healthy_key_for_testing():
    # Use config-specific API key based on provider
    if HEALTH_API_KEY:
        return HEALTH_API_KEY
    env_key = os.environ.get("OPENROUTER_API_KEY")
    if env_key:
        return env_key
    
    # Try pool
    pool_str = os.getenv("OPENROUTER_KEYS_POOL") or os.getenv("SCRUM_TEAM_OPENROUTER_KEY")
    if pool_str:
        keys = [k.strip(' "\'') for k in pool_str.split(",") if k.strip(' "\'')]
        if keys:
            return keys[0]
    return None


def check_model_health(model_name, api_key_default=None):
    """Check model health resolving provider dynamically from model name."""
    prov = "openrouter"
    m_name = model_name
    if "/" in model_name:
        parts = model_name.split("/", 1)
        if parts[0] in ["openai", "groq", "nvidia", "openrouter"]:
            prov = parts[0]
            m_name = parts[1]
            
    if prov == "nvidia":
        api_base = "https://integrate.api.nvidia.com/v1"
        api_key = os.getenv("NVIDIA_API_KEY") or api_key_default or ""
    elif prov == "openai":
        api_base = "https://api.openai.com/v1"
        api_key = os.getenv("OPENAI_API_KEY") or api_key_default or ""
    elif prov == "groq":
        api_base = "https://api.groq.com/openai/v1"
        api_key = os.getenv("GROQ_API_KEY") or api_key_default or ""
    else:
        api_base = "https://openrouter.ai/api/v1"
        api_key = os.getenv("SCRUM_TEAM_OPENROUTER_KEY") or os.getenv("OPENROUTER_API_KEY") or api_key_default or ""
        
    url = f"{api_base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip(' \"\'')}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": m_name,
        "messages": [{"role": "user", "content": "say ok"}],
        "max_tokens": 5
    }

    start_time = time.time()
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=8)
        latency = round(time.time() - start_time, 2)

        if response.status_code == 200:
            return {"status": "healthy", "latency": latency}
        elif response.status_code == 429:
            return {"status": "rate_limited", "latency": latency, "error": "429 Rate Limit"}
        else:
            return {"status": "unhealthy", "latency": latency, "error": f"Status {response.status_code}: {response.text[:100]}"}
    except requests.exceptions.Timeout:
        return {"status": "unhealthy", "latency": 8.0, "error": "Timeout"}
    except Exception as e:
        return {"status": "unhealthy", "latency": round(time.time() - start_time, 2), "error": str(e)}


def run_health_check_cycle():
    api_key = get_healthy_key_for_testing()
    if not api_key:
        logger.warning("[Health Worker] Warning: No API key found to perform health check.")
        return

    logger.info(f"🔍 [Health Worker - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]: Checking health of models...")

    models_status = {}
    healthiest_model = None
    best_latency = float("inf")

    for model in CANDIDATE_MODELS:
        status_info = check_model_health(model, api_key)
        models_status[model] = status_info
        logger.info(f"  - {model}: {status_info['status'].upper()} (Latency: {status_info['latency']}s) {status_info.get('error', '')}")

        if status_info["status"] == "healthy" and status_info["latency"] < best_latency:
            best_latency = status_info["latency"]
            healthiest_model = model

    # Fallback to default if all are down
    if healthiest_model is None:
        healthiest_model = DEFAULT_MODEL
        logger.warning(f"  ⚠️  All models down. Falling back to default: {DEFAULT_MODEL}")

    # Write the health status file
    status_data = {
        "healthiest_model": healthiest_model,
        "last_check": datetime.now().isoformat(),
        "models_status": models_status
    }

    try:
        with open(STATUS_PATH, "w", encoding="utf-8") as f:
            json.dump(status_data, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ [Health Worker]: Healthiest model written to {STATUS_PATH}: {healthiest_model}")
    except Exception as e:
        logger.error(f"[Health Worker] Error writing health status file: {e}")


def mark_model_unhealthy(model_name, error_msg="Crew encountered error"):
    try:
        if os.path.exists(STATUS_PATH):
            try:
                with open(STATUS_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        else:
            data = {}
            
        if "models_status" not in data:
            data["models_status"] = {}
            
        # Mark current model down
        data["models_status"][model_name] = {
            "status": "rate_limited" if "429" in error_msg or "rate limit" in error_msg.lower() else "unhealthy",
            "latency": 9.9,
            "error": error_msg[:100]
        }
        
        # Recalculate healthiest model
        best_model = None
        best_latency = float("inf")
        for model, info in data.get("models_status", {}).items():
            if info.get("status") == "healthy" and info.get("latency", 9.9) < best_latency:
                best_latency = info.get("latency", 9.9)
                best_model = model
                
        if not best_model:
            # Try to get any model that is NOT the currently failing one
            for model in data.get("models_status", {}).keys():
                if model != model_name:
                    best_model = model
                    break
                    
        if not best_model:
            best_model = DEFAULT_MODEL
            
        data["healthiest_model"] = best_model
        data["last_check"] = datetime.now().isoformat()
        
        with open(STATUS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"🚨 [Model Router]: Marcando {model_name} como inactivo. Nuevo modelo: {best_model}")
    except Exception as e:
        logger.error(f"[!] Error al actualizar estado de modelos: {e}")


def start_daemon_worker():
    import threading
    def worker_loop():
        try:
            run_health_check_cycle()
        except Exception as e:
            logger.error(f"[Health Worker Initial Loop Exception]: {e}")

        while True:
            time.sleep(300)  # Every 5 minutes
            try:
                run_health_check_cycle()
            except Exception as e:
                logger.error(f"[Health Worker Loop Exception]: {e}")

    t = threading.Thread(target=worker_loop, daemon=True, name="ModelHealthWorkerThread")
    t.start()
    logger.info("🚀 [Health Worker]: Background thread started.")


if __name__ == "__main__":
    # If run directly, run cycle and loop
    try:
        while True:
            run_health_check_cycle()
            time.sleep(300)
    except KeyboardInterrupt:
        print("\n[Health Worker] Stopped by user.")
