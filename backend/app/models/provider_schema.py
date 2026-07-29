from typing import Literal

from pydantic import BaseModel, Field


ValidationReason = Literal[
    "ok",
    "invalid_key",
    "model_not_available",
    "rate_limited",
    "unreachable",
    "unknown",
]


class ProviderValidationResult(BaseModel):
    valid: bool = Field(description="True only when the provider accepted the credentials.")
    reason: ValidationReason = Field(
        description="Stable code for the outcome. Clients branch on this, never on `message`."
    )
    message: str = Field(description="Human-readable explanation, safe to render as-is.")
    provider: str
    model: str
