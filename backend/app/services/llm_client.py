import json
import re
from typing import Any

from litellm import completion

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError


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
    def extract_json(self, prompt: str, source_text: str, context: ProviderContext) -> dict | None:
        if not context.api_key or not context.model:
            raise ProviderConfigurationError("Falta la API key o el modelo configurado para usar el proveedor.")

        provider_model = context.model
        if context.provider and "/" not in provider_model:
            provider_model = f"{context.provider}/{provider_model}"

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
        except Exception as exc:
            raise ProviderRequestError(f"Fallo la llamada al proveedor {context.provider or 'LLM'}.") from exc

        response_choices = getattr(response, "choices", None)
        if not response_choices:
            raise ProviderResponseFormatError("El proveedor no devolvio choices utilizables.")
        response_message: Any = getattr(response_choices[0], "message", None)
        content = getattr(response_message, "content", None)
        if not content:
            raise ProviderResponseFormatError("El proveedor no devolvio contenido.")
        return _extract_json_payload(content)
