from fastapi import APIRouter, Depends

from app.api.deps import ProviderContext, get_provider_context
from app.models.cover_letter_schema import CoverLetterRequest, CoverLetterResult
from app.services.cover_letter_service import CoverLetterService


router = APIRouter()
service = CoverLetterService()


@router.post("/cover-letter/generate", response_model=CoverLetterResult)
def generate_cover_letter(
    payload: CoverLetterRequest,
    context: ProviderContext = Depends(get_provider_context),
) -> CoverLetterResult:
    return service.generate(payload.cv, payload.job, context, payload.tone)
