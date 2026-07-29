import logging
import time
from dataclasses import dataclass
from typing import Any

from litellm import completion
from litellm.exceptions import (
    APIConnectionError,
    AuthenticationError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    Timeout,
)

from app.api.deps import ProviderContext
from app.core.provider_catalog import provider_label


logger = logging.getLogger(__name__)

VALIDATION_TIMEOUT_SECONDS = 15
MAX_PROVIDER_MESSAGE_CHARS = 300


@dataclass
class ValidationOutcome:
    """Result of pinging a provider with the user's credentials.

    `reason` is a stable code, not prose: the frontend decides whether to block
    on it, so it must not depend on the wording of `message`.
    """

    valid: bool
    reason: str
    message: str


def _sanitize(text: str, api_key: str | None) -> str:
    """Never echo the caller's key back, and keep provider prose bounded."""
    cleaned = " ".join(str(text).split())
    if api_key and len(api_key) >= 8:
        cleaned = cleaned.replace(api_key, "***")
    if len(cleaned) > MAX_PROVIDER_MESSAGE_CHARS:
        cleaned = cleaned[:MAX_PROVIDER_MESSAGE_CHARS] + "..."
    return cleaned


class ProviderValidationService:
    """Verifies that an API key actually belongs to the selected provider.

    A key prefix check cannot do this: OpenAI and DeepSeek keys both start with
    `sk-`, so the only reliable signal is what the provider itself answers to an
    authenticated request. The ping is a 1-token completion, which is the
    cheapest call that is portable across every provider litellm supports.
    """

    def validate(self, context: ProviderContext) -> ValidationOutcome:
        label = provider_label(context.provider)
        provider_model = context.model or ""
        if context.provider and "/" not in provider_model:
            provider_model = f"{context.provider}/{provider_model}"

        started = time.perf_counter()
        try:
            completion(
                model=provider_model,
                api_key=context.api_key,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
                timeout=VALIDATION_TIMEOUT_SECONDS,
            )
        except (AuthenticationError, PermissionDeniedError) as exc:
            self._log(provider_model, started, "invalid_key")
            return ValidationOutcome(
                valid=False,
                reason="invalid_key",
                message=(
                    f"{label} rechazó la API key. Verificá que la clave pertenezca a {label}: "
                    f"una clave de otro proveedor siempre será rechazada. "
                    f"Respuesta del proveedor: {_sanitize(exc, context.api_key)}"
                ),
            )
        except NotFoundError as exc:
            self._log(provider_model, started, "model_not_available")
            return ValidationOutcome(
                valid=False,
                reason="model_not_available",
                message=(
                    f"La key es válida para {label}, pero el modelo '{context.model}' no está "
                    f"disponible para esta cuenta. Elegí otro modelo. "
                    f"Respuesta del proveedor: {_sanitize(exc, context.api_key)}"
                ),
            )
        except RateLimitError:
            # A 429 is returned after authentication, so the key is good.
            self._log(provider_model, started, "rate_limited")
            return ValidationOutcome(
                valid=True,
                reason="rate_limited",
                message=(
                    f"La key es válida para {label}, pero la cuenta está limitada por cuota o "
                    "rate limit en este momento."
                ),
            )
        except (APIConnectionError, Timeout) as exc:
            self._log(provider_model, started, "unreachable")
            return ValidationOutcome(
                valid=False,
                reason="unreachable",
                message=(
                    f"No se pudo contactar a {label} para verificar la key: "
                    f"{_sanitize(exc, context.api_key)}"
                ),
            )
        except Exception as exc:
            self._log(provider_model, started, "unknown")
            return ValidationOutcome(
                valid=False,
                reason="unknown",
                message=(
                    f"No se pudo verificar la key contra {label}: "
                    f"{_sanitize(exc, context.api_key)}"
                ),
            )

        self._log(provider_model, started, "ok")
        return ValidationOutcome(
            valid=True,
            reason="ok",
            message=f"La API key es válida para {label} y el modelo '{context.model}' responde.",
        )

    def _log(self, provider_model: str, started: float, reason: str) -> None:
        logger.info(
            "provider_validation model=%s elapsed_ms=%.0f reason=%s",
            provider_model,
            (time.perf_counter() - started) * 1000,
            reason,
        )


def as_response_payload(outcome: ValidationOutcome, context: ProviderContext) -> dict[str, Any]:
    return {
        "valid": outcome.valid,
        "reason": outcome.reason,
        "message": outcome.message,
        "provider": context.provider or "",
        "model": context.model or "",
    }
