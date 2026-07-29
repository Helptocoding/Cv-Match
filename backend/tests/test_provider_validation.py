import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from litellm.exceptions import (
    APIConnectionError,
    AuthenticationError,
    NotFoundError,
    RateLimitError,
)

from app.api.deps import ProviderContext, get_provider_context
from app.core.exceptions import ProviderAuthError
from app.core.provider_catalog import validate_provider_request
from app.main import app
from app.services import llm_client as llm_client_module
from app.services import provider_validation_service as validation_module
from app.services.extraction_service import ExtractionService
from app.services.llm_client import LLMClient
from app.services.provider_validation_service import ProviderValidationService


client = TestClient(app)

OPENAI_HEADERS = {
    "X-AI-Provider": "openai",
    "X-AI-Model": "gpt-4o",
    "X-Provider-Api-Key": "sk-a-deepseek-key-pasted-by-mistake",
}


def _context(api_key: str = "sk-test") -> ProviderContext:
    return ProviderContext(provider="openai", model="gpt-4o", api_key=api_key)


def _raises(exc: Exception):
    def _completion(**_kwargs):
        raise exc

    return _completion


# --- static catalog checks (provider <-> model) --------------------------------


def test_validate_provider_request_rejects_model_provider_mismatch() -> None:
    error = validate_provider_request("openai", "deepseek-v4-flash", "sk-test")
    assert error is not None
    assert "no pertenece" in error


def test_validate_provider_request_accepts_known_provider_and_model() -> None:
    error = validate_provider_request("groq", "llama-3.3-70b-versatile", "gsk_test")
    assert error is None


def test_get_provider_context_raises_http_400_for_mismatch() -> None:
    try:
        get_provider_context(
            x_ai_provider="openai",
            x_ai_model="deepseek-v4-flash",
            x_provider_api_key="sk-test",
        )
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "no pertenece" in str(exc.detail)
    else:
        raise AssertionError("Expected get_provider_context to raise HTTPException")


# --- live checks (key <-> provider) -------------------------------------------


def test_validate_detects_key_belonging_to_another_provider(monkeypatch) -> None:
    # A DeepSeek key starts with `sk-`, exactly like an OpenAI one, so only the
    # provider's own 401 can tell them apart.
    monkeypatch.setattr(
        validation_module,
        "completion",
        _raises(AuthenticationError("Incorrect API key provided", "openai", "gpt-4o")),
    )

    outcome = ProviderValidationService().validate(_context("sk-deepseek-key"))

    assert outcome.valid is False
    assert outcome.reason == "invalid_key"
    assert "OpenAI" in outcome.message


def test_validate_never_echoes_the_api_key_back(monkeypatch) -> None:
    key = "sk-supersecret-value-123456"
    monkeypatch.setattr(
        validation_module,
        "completion",
        _raises(AuthenticationError(f"Incorrect API key provided: {key}", "openai", "gpt-4o")),
    )

    outcome = ProviderValidationService().validate(_context(key))

    assert key not in outcome.message
    assert "***" in outcome.message


def test_validate_reports_model_not_available(monkeypatch) -> None:
    monkeypatch.setattr(
        validation_module,
        "completion",
        _raises(NotFoundError("The model does not exist", "gpt-4o", "openai")),
    )

    outcome = ProviderValidationService().validate(_context())

    assert outcome.valid is False
    assert outcome.reason == "model_not_available"


def test_validate_treats_rate_limit_as_a_valid_key(monkeypatch) -> None:
    # A 429 is only returned after the request authenticated successfully.
    monkeypatch.setattr(
        validation_module,
        "completion",
        _raises(RateLimitError("slow down", "openai", "gpt-4o")),
    )

    outcome = ProviderValidationService().validate(_context())

    assert outcome.valid is True
    assert outcome.reason == "rate_limited"


def test_validate_reports_unreachable_without_blaming_the_key(monkeypatch) -> None:
    monkeypatch.setattr(
        validation_module,
        "completion",
        _raises(APIConnectionError("connection refused", "openai", "gpt-4o")),
    )

    outcome = ProviderValidationService().validate(_context())

    assert outcome.valid is False
    assert outcome.reason == "unreachable"


def test_validate_pings_with_the_prefixed_model_and_a_single_token(monkeypatch) -> None:
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(validation_module, "completion", _completion)

    outcome = ProviderValidationService().validate(_context())

    assert outcome.valid is True
    assert outcome.reason == "ok"
    assert captured["model"] == "openai/gpt-4o"
    assert captured["max_tokens"] == 1


# --- rejected keys must not degrade into heuristic results --------------------


def test_llm_client_raises_auth_error_not_generic_request_error(monkeypatch) -> None:
    monkeypatch.setattr(
        llm_client_module,
        "completion",
        _raises(AuthenticationError("Incorrect API key provided", "openai", "gpt-4o")),
    )

    with pytest.raises(ProviderAuthError) as excinfo:
        LLMClient().extract_json("prompt", "source", _context())

    assert "OpenAI" in str(excinfo.value)


def test_extraction_service_does_not_fall_back_when_the_key_is_rejected(monkeypatch) -> None:
    service = ExtractionService()

    def _boom(*_args, **_kwargs):
        raise ProviderAuthError("OpenAI rechazó la API key.")

    monkeypatch.setattr(service.llm, "extract_json", _boom)

    with pytest.raises(ProviderAuthError):
        service.parse_cv("Juan Perez\nPython developer", _context())


# --- HTTP surface --------------------------------------------------------------


def test_validate_endpoint_returns_reason_code_for_a_foreign_key(monkeypatch) -> None:
    monkeypatch.setattr(
        validation_module,
        "completion",
        _raises(AuthenticationError("Incorrect API key provided", "openai", "gpt-4o")),
    )

    response = client.post("/api/v1/provider/validate", headers=OPENAI_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert body["reason"] == "invalid_key"
    assert body["provider"] == "openai"


def test_validate_endpoint_rejects_a_missing_key() -> None:
    response = client.post(
        "/api/v1/provider/validate",
        headers={"X-AI-Provider": "openai", "X-AI-Model": "gpt-4o", "X-Provider-Api-Key": "  "},
    )

    assert response.status_code == 400


def test_validate_endpoint_still_rejects_model_provider_mismatch() -> None:
    response = client.post(
        "/api/v1/provider/validate",
        headers={
            "X-AI-Provider": "openai",
            "X-AI-Model": "deepseek-v4-flash",
            "X-Provider-Api-Key": "sk-test",
        },
    )

    assert response.status_code == 400
    assert "no pertenece" in response.json()["detail"]


def test_parse_cv_returns_401_instead_of_a_heuristic_200(monkeypatch) -> None:
    from app.api.routes import parse as parse_route

    def _boom(*_args, **_kwargs):
        raise ProviderAuthError("OpenAI rechazó la API key.")

    monkeypatch.setattr(parse_route.service.llm, "extract_json", _boom)

    response = client.post(
        "/api/v1/parse/cv",
        data={"raw_text": "Juan Perez\nPython developer"},
        headers=OPENAI_HEADERS,
    )

    assert response.status_code == 401
    assert "API key" in response.json()["detail"]
