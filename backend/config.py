from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str
    DATABASE_URL: str
    PORT: int = 8000
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    WHATSAPP_NUMBER: str = "254792125943"

    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_PASSKEY: str = ""
    MPESA_SHORTCODE: str = ""
    MPESA_CALLBACK_URL: str = ""
    # "sandbox" or "production"
    MPESA_ENV: str = "sandbox"

    @property
    def mpesa_base_url(self) -> str:
        if self.MPESA_ENV == "production":
            return "https://api.safaricom.co.ke"
        return "https://sandbox.safaricom.co.ke"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Guard: crash loudly on startup if the dev placeholder key is still set
_WEAK_KEYS = {"dev-secret-key-change-in-production", "change-me-to-a-random-secret-key", ""}
if settings.SECRET_KEY in _WEAK_KEYS:
    raise RuntimeError(
        "SECRET_KEY is not set or is still the default placeholder. "
        "Generate a strong key with: python -c \"import secrets; print(secrets.token_hex(64))\""
    )
