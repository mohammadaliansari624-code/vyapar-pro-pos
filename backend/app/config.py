import os
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://vyapar:change-me@localhost:5432/vyapar"
    secret_key: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_BEFORE_DEPLOYMENT"
    admin_emails: str = ""  # set ADMIN_EMAILS in backend/.env
    frontend_origins: str = "http://localhost:5173"
    session_days: int = 1
    remember_session_days: int = 30
    cookie_secure: bool = False
    app_timezone: str = "Asia/Kolkata"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def admins(self) -> set[str]:
        return {x.strip().lower() for x in self.admin_emails.split(",") if x.strip()}

    @property
    def origins(self) -> list[str]:
        return [x.strip() for x in self.frontend_origins.split(",") if x.strip()]

settings = Settings()
