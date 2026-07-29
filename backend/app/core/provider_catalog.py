from collections.abc import Iterable


PROVIDER_MODELS: dict[str, set[str]] = {
    "openai": {
        "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
        "gpt-5.5", "gpt-5.5-pro",
        "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano",
        "gpt-5.4-mini-2026-03-17", "gpt-5.4-nano-2026-03-17",
        "gpt-5.3-codex",
        "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
        "gpt-4.1-2025-04-14", "gpt-4.1-mini-2025-04-14", "gpt-4.1-nano-2025-04-14",
        "o3", "o3-2025-04-16", "o3-pro",
        "o4-mini", "o4-mini-2025-04-16",
        "gpt-4o", "gpt-4o-2024-11-20",
        "gpt-4o-mini", "gpt-4o-mini-2024-07-18",
        "gpt-4-turbo", "gpt-4-turbo-2024-04-09",
        "gpt-4", "gpt-4-0613",
        "gpt-4-0125-preview", "gpt-4-1106-preview",
        "gpt-3.5-turbo", "gpt-3.5-turbo-0125",
        "o1", "o1-2024-12-17",
        "gpt-4o-audio-preview", "gpt-4o-audio-preview-2025-06-03",
        "gpt-4o-mini-audio-preview",
        "gpt-4o-search-preview", "gpt-4o-mini-search-preview",
        "chatgpt-4o-latest",
    },
    "anthropic": {
        "claude-fable-5", "claude-mythos-5",
        "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
        "claude-opus-4-5-20251101",
        "claude-sonnet-5", "claude-sonnet-4-6", "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001",
    },
    "gemini": {
        "gemini-3.5-flash", "gemini-3.5-flash-lite",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite", "gemini-3.1-flash-image",
        "gemini-3-pro-image",
        "gemini-3-flash-preview",
        "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite",
        "gemini-2.5-flash-image",
    },
    "deepseek": {
        "deepseek-v4-flash", "deepseek-v4-pro",
    },
    "groq": {
        "llama-3.3-70b-versatile", "llama-3.1-8b-instant",
        "openai/gpt-oss-120b", "openai/gpt-oss-20b",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "meta-llama/llama-guard-4-12b",
        "groq/compound", "groq/compound-mini",
        "qwen/qwen3-32b", "qwen/qwen3.6-27b",
        "moonshotai/kimi-k2-instruct-0905",
    },
    "together": {
        "meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo",
        "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
        "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
        "mistralai/Mixtral-8x22B-Instruct-v0.1",
        "mistralai/Mistral-7B-Instruct-v0.3",
        "togethercomputer/llama-3-70b-chat",
        "togethercomputer/llama-3-8b-chat",
        "togethercomputer/CodeLlama-34b-Instruct",
        "togethercomputer/CodeLlama-13b-Instruct",
        "togethercomputer/CodeLlama-7b-Instruct",
        "microsoft/WizardLM-2-8x22B",
    },
    "mistral": {
        "mistral-large-latest", "mistral-large-2407", "mistral-large-2411",
        "mistral-small-latest", "mistral-small-2409",
        "open-mistral-7b", "open-mixtral-8x7b", "open-mixtral-8x22b",
        "mistral-embed",
    },
    "openrouter": {
        "openai/gpt-4o", "openai/gpt-4o-mini",
        "openai/gpt-4-turbo",
        "anthropic/claude-3.5-sonnet", "anthropic/claude-3-haiku",
        "google/gemini-1.5-pro", "google/gemini-1.5-flash",
        "deepseek/deepseek-chat",
        "mistral/mistral-large",
        "meta-llama/llama-3.3-70b-instruct",
    },
}


PROVIDER_LABELS: dict[str, str] = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "gemini": "Google Gemini",
    "deepseek": "DeepSeek",
    "groq": "Groq",
    "together": "Together",
    "mistral": "Mistral",
    "openrouter": "OpenRouter",
}


def provider_ids() -> Iterable[str]:
    return PROVIDER_MODELS.keys()


def provider_label(provider: str | None) -> str:
    if not provider:
        return "el proveedor"
    return PROVIDER_LABELS.get(provider.strip().lower(), provider)


def validate_provider_request(provider: str | None, model: str | None, api_key: str | None) -> str | None:
    if not provider or not model:
        return None

    normalized_provider = provider.strip().lower()
    normalized_model = model.strip()
    allowed_models = PROVIDER_MODELS.get(normalized_provider)

    if allowed_models is None:
        supported = ", ".join(sorted(provider_ids()))
        return f"Proveedor desconocido: '{provider}'. Proveedores soportados: {supported}."

    if normalized_model not in allowed_models:
        return (
            f"El modelo '{model}' no pertenece al proveedor '{provider}'. "
            "Elegí un modelo válido para ese proveedor antes de intentar la llamada."
        )

    return None
