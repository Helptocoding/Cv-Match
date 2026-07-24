from dataclasses import dataclass

from fastapi import Header


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
    return ProviderContext(
        provider=x_ai_provider,
        model=x_ai_model,
        api_key=x_provider_api_key,
    )
