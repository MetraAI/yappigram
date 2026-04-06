from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tgcrm:changeme@db:5432/tgcrm"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ACCESS_EXPIRE_MINUTES: int = 480  # 8 hours
    JWT_REFRESH_EXPIRE_DAYS: int = 30

    # Encryption
    ENCRYPTION_KEY: str = ""

    # Telegram MTProto
    TG_API_ID: int = 0
    TG_API_HASH: str = ""

    # Telegram Bot
    TG_BOT_TOKEN: str = ""
    TG_ADMIN_CHAT_ID: int = 0

    # App
    APP_URL: str = "http://localhost:3000"
    WEBAPP_URL: str = ""  # Public HTTPS URL for TG Mini App (e.g. https://crm.example.com)
    CORS_ORIGINS: str = "http://localhost:3000"

    # SSO — PostForge integration
    POSTFORGE_API_URL: str = ""  # e.g. http://backend:8000 (internal) or https://metra-ai.org
    POSTFORGE_SSO_SECRET: str = ""  # Shared secret for SSO token exchange
    POSTFORGE_BOT_TOKEN: str = ""  # PostForge bot token (for Mini App initData validation)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Startup validation: warn about insecure defaults
import warnings as _warnings
if settings.JWT_SECRET in ("change-me", ""):
    _warnings.warn("JWT_SECRET is using default value — set a secure secret in .env!", stacklevel=1)
if "changeme" in settings.DATABASE_URL:
    _warnings.warn("DATABASE_URL contains default password 'changeme' — update in .env!", stacklevel=1)
if not settings.ENCRYPTION_KEY:
    _warnings.warn("ENCRYPTION_KEY is empty — contact data encryption will not work!", stacklevel=1)
