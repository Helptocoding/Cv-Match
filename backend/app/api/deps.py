from dataclasses import dataclass

from fastapi import Header, HTTPException

from app.core.provider_catalog import validate_provider_request


@dataclass
class ProviderContext:
    provider: str | None
    model: str | None
    api_key: str | None


def get_provider_context(
    x_ai_provider: str | None = Header(default=None),
    x_ai_model: str | None = Header(default=None),
    x_provider_api_key: str | None = Header(default=None),
) -> ProviderContext:
    validation_error = validate_provider_request(x_ai_provider, x_ai_model, x_provider_api_key)
    if validation_error:
        raise HTTPException(status_code=400, detail=validation_error)

    return ProviderContext(
        provider=x_ai_provider,
        model=x_ai_model,
        api_key=x_provider_api_key,
    )
