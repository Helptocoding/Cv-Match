import json
import logging
import re
import time
from typing import Any

from litellm import completion
from litellm.exceptions import AuthenticationError, PermissionDeniedError

from app.api.deps import ProviderContext
from app.core.exceptions import (
    ProviderAuthError,
    ProviderConfigurationError,
    ProviderRequestError,
    ProviderResponseFormatError,
)
from app.core.provider_catalog import provider_label


logger = logging.getLogger(__name__)

JSON_BLOCK_PATTERN = re.compile(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", re.DOTALL)


def _extract_json_payload(content: str) -> dict:
    normalized = content.strip()
    match = JSON_BLOCK_PATTERN.search(normalized)
    if match:
        normalized = match.group(1).strip()

    start_object = normalized.find("{")
    start_array = normalized.find("[")
    start_positions = [position for position in [start_object, start_array] if position >= 0]
    if start_positions:
        normalized = normalized[min(start_positions):]

    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError as exc:
        raise ProviderResponseFormatError("El proveedor devolvio JSON invalido.") from exc

    if not isinstance(parsed, dict):
        raise ProviderResponseFormatError("El proveedor devolvio un JSON con formato inesperado.")
    return parsed


class LLMClient:
    # Set by callers so latency logs identify which pipeline stage was slow.
    stage: str = "llm"

    def extract_json(self, prompt: str, source_text: str, context: ProviderContext) -> dict | None:
        if not context.api_key or not context.model:
            raise ProviderConfigurationError("Falta la API key o el modelo configurado para usar el proveedor.")

        provider_model = context.model
        if context.provider and "/" not in provider_model:
            provider_model = f"{context.provider}/{provider_model}"

        started = time.perf_counter()
        try:
            response: Any = completion(
                model=provider_model,
                api_key=context.api_key,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": source_text},
                ],
                response_format={"type": "json_object"},
                temperature=0,
                timeout=45,
            )
        except (AuthenticationError, PermissionDeniedError) as exc:
            # Must not degrade to the heuristic fallback: a rejected key is a
            # configuration error the user has to fix, not a transient failure.
            # Swallowing it here would return HTTP 200 with regex-parsed data
            # and let the user believe the LLM ran.
            logger.warning(
                "llm_latency stage=%s model=%s elapsed_ms=%.0f outcome=auth_error",
                self.stage, provider_model, (time.perf_counter() - started) * 1000,
            )
            label = provider_label(context.provider)
            raise ProviderAuthError(
                f"{label} rechazó la API key. Verificá que la clave pertenezca a {label} "
                f"y que tenga acceso al modelo '{context.model}'."
            ) from exc
        except Exception as exc:
            logger.warning(
                "llm_latency stage=%s model=%s elapsed_ms=%.0f outcome=error",
                self.stage, provider_model, (time.perf_counter() - started) * 1000,
            )
            raise ProviderRequestError(f"Fallo la llamada al proveedor {context.provider or 'LLM'}.") from exc

        usage = getattr(response, "usage", None)
        logger.info(
            "llm_latency stage=%s model=%s elapsed_ms=%.0f in_tok=%s out_tok=%s sent_bytes=%d",
            self.stage,
            provider_model,
            (time.perf_counter() - started) * 1000,
            getattr(usage, "prompt_tokens", "?"),
            getattr(usage, "completion_tokens", "?"),
            len(prompt.encode("utf-8")) + len(source_text.encode("utf-8")),
        )

        response_choices = getattr(response, "choices", None)
        if not response_choices:
            raise ProviderResponseFormatError("El proveedor no devolvio choices utilizables.")
        response_message: Any = getattr(response_choices[0], "message", None)
        content = getattr(response_message, "content", None)
        if not content:
            raise ProviderResponseFormatError("El proveedor no devolvio contenido.")
        return _extract_json_payload(content)
