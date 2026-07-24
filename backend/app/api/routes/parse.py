from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import ProviderContext, get_provider_context
from app.models.cv_schema import StructuredCV
from app.models.job_schema import StructuredJob
from app.services.document_parser import extract_text_from_upload
from app.services.extraction_service import ExtractionService


router = APIRouter()
service = ExtractionService()


@router.post("/parse/cv", response_model=StructuredCV)
async def parse_cv(
    raw_text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    provider_context: ProviderContext = Depends(get_provider_context),
) -> StructuredCV:
    if not raw_text and not file:
        raise HTTPException(status_code=400, detail="Provide either raw_text or a file upload.")

    text = raw_text or ""
    if file is not None:
        content = await file.read()
        text = extract_text_from_upload(file.filename or "upload.txt", content)

    return service.parse_cv(text, provider_context)


@router.post("/parse/job", response_model=StructuredJob)
async def parse_job(
    raw_text: str = Form(...),
    provider_context: ProviderContext = Depends(get_provider_context),
) -> StructuredJob:
    return service.parse_job(raw_text, provider_context)
