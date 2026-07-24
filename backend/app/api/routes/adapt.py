from pydantic import BaseModel
from fastapi import APIRouter, Depends

from app.api.deps import ProviderContext, get_provider_context
from app.models.cv_schema import StructuredCV
from app.models.export_schema import AdaptedCV
from app.models.job_schema import StructuredJob
from app.services.adaptation_service import AdaptationService


class AdaptRequest(BaseModel):
    original_cv_structured: StructuredCV
    job_structured: StructuredJob


router = APIRouter()
service = AdaptationService()


@router.post("/adapt/cv", response_model=AdaptedCV)
def adapt_cv(
    payload: AdaptRequest,
    provider_context: ProviderContext = Depends(get_provider_context),
) -> AdaptedCV:
    return service.adapt_cv(payload.original_cv_structured, payload.job_structured, provider_context)
