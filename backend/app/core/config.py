from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_cors_origins(value: object) -> list[str]:
    if value is None or value == "":
        return ["http://localhost:3000"]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("["):
            import json

            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except ValueError:
                pass
        return [item.strip() for item in text.split(",") if item.strip()]
    return ["http://localhost:3000"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    backend_cors_origins: str = Field(default="http://localhost:3000")

    @property
    def cors_origins_list(self) -> list[str]:
        return _parse_cors_origins(self.backend_cors_origins)


@lru_cache
def get_settings() -> Settings:
    return Settings()
