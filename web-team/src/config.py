import os
from typing import Optional, Any
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MODEL_DEFAULT: str = "openrouter/owl-alpha"
    SCRUM_TEAM_OPENROUTER_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None
    LLM_RPM_LIMIT: int = 5
    
    KAFKA_BROKER: str = "kafka:9092"
    
    MYSQL_HOST: str = "mysql"
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "widowmaker"
    MYSQL_DATABASE: str = "cloud_master"
    
    REDIS_HOST: str = "redis_server"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "Elian2020#"
    
    CHAT_SOCKET_URL: str = "http://chat-socket-service:3001"

    @property
    def llm_config(self) -> dict[str, Any]:
        openrouter_base = "https://openrouter.ai/api/v1"
        
        # Clean quotes if any from keys
        def clean_key(val: Optional[str]) -> Optional[str]:
            if not val:
                return None
            return val.strip(' "\'')

        sr_key = clean_key(self.SCRUM_TEAM_OPENROUTER_KEY)
        or_key = clean_key(self.OPENROUTER_API_KEY)
        oa_key = clean_key(self.OPENAI_API_KEY)
        gr_key = clean_key(self.GROQ_API_KEY)
        nv_key = clean_key(self.NVIDIA_API_KEY)

        openrouter_key = sr_key or or_key or oa_key or "sk-or-placeholder"
        model_default = self.MODEL_DEFAULT or "openrouter/owl-alpha"

        if "/" in model_default:
            provider, model_name = model_default.split("/", 1)
        else:
            provider = "openrouter"
            model_name = model_default

        extra_kwargs = {}
        if provider == "openai":
            llm_model = f"openai/{model_name}" if not model_name.startswith("openai/") else model_name
            llm_base_url = "https://api.openai.com/v1"
            llm_api_key = oa_key or openrouter_key
        elif provider == "groq":
            llm_model = f"openai/{model_name}"
            llm_base_url = openrouter_base
            llm_api_key = gr_key or openrouter_key
        elif provider == "nvidia":
            llm_model = f"openai/{model_name}"
            llm_base_url = "https://integrate.api.nvidia.com/v1"
            llm_api_key = nv_key or ""
            extra_kwargs["extra_body"] = {"chat_template_kwargs": {"thinking": True}}
        else:
            # OpenRouter (default)
            llm_model = f"openai/{model_name}"
            llm_base_url = openrouter_base
            llm_api_key = openrouter_key

        return {
            "model": llm_model,
            "base_url": llm_base_url,
            "api_key": llm_api_key,
            "extra_kwargs": extra_kwargs
        }

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

