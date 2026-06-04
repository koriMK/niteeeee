from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str
    DATABASE_URL: str
    PORT: int = 8000
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    WHATSAPP_NUMBER: str = "254792125943"

    TUMA_BASE_URL: str = "https://api.tuma.co.ke"
    TUMA_EMAIL: str = ""
    TUMA_API_KEY: str = ""
    TUMA_CALLBACK_URL: str = ""

    model_config = {
        "extra": "ignore",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()

# Guard: crash loudly on startup if the dev placeholder key is still set
_WEAK_KEYS = {"dev-secret-key-change-in-production", "change-me-to-a-random-secret-key", ""}
if settings.SECRET_KEY in _WEAK_KEYS:
    raise RuntimeError(
        "SECRET_KEY is not set or is still the default placeholder. "
        "Generate a strong key with: python -c \"import secrets; print(secrets.token_hex(64))\""
    )
