from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import ProviderContext, get_provider_context
from app.models.provider_schema import ProviderValidationResult
from app.services.provider_validation_service import (
    ProviderValidationService,
    as_response_payload,
)


router = APIRouter()
service = ProviderValidationService()


@router.post("/provider/validate", response_model=ProviderValidationResult)
def validate_provider(
    context: ProviderContext = Depends(get_provider_context),
) -> ProviderValidationResult:
    """Ping the provider with the caller's credentials.

    Returns 200 with `valid=false` for credential problems instead of an error
    status: this is a diagnostic endpoint, and the client needs the reason code
    to decide whether to block the user or only warn them.
    """
    if not context.provider or not context.model:
        raise HTTPException(status_code=400, detail="Faltan los headers de proveedor y modelo.")
    if not context.api_key or not context.api_key.strip():
        raise HTTPException(status_code=400, detail="Falta la API key a validar.")

    outcome = service.validate(context)
    return ProviderValidationResult(**as_response_payload(outcome, context))
