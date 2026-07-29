from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query

from app.api.deps import ProviderContext, get_provider_context
from app.models.adaptation_schema import ApprovedLatentSkill, SkillCoverageItem, SkillCoverageResult
from app.models.cv_schema import StructuredCV
from app.models.export_schema import AdaptedCV
from app.models.job_schema import StructuredJob
from app.services.adaptation_service import AdaptationService


class AdaptRequest(BaseModel):
    original_cv_structured: StructuredCV
    job_structured: StructuredJob


class FinalizeAdaptRequest(BaseModel):
    original_cv_structured: StructuredCV
    job_structured: StructuredJob
    approved_latent_skills: list[ApprovedLatentSkill]
    # Coverage already computed during /adapt/cv?mode=deep and shown in the
    # wizard. Sent back so finalization does not recompute it.
    skill_coverage: list[SkillCoverageItem] | None = None


router = APIRouter()
service = AdaptationService()


@router.post("/adapt/cv", response_model=AdaptedCV)
def adapt_cv(
    payload: AdaptRequest,
    mode: str = Query(default="fast"),
    provider_context: ProviderContext = Depends(get_provider_context),
) -> AdaptedCV:
    return service.adapt_cv(payload.original_cv_structured, payload.job_structured, provider_context, mode=mode)


@router.post("/adapt/cv/finalize", response_model=AdaptedCV)
def finalize_adapt(
    payload: FinalizeAdaptRequest,
    provider_context: ProviderContext = Depends(get_provider_context),
) -> AdaptedCV:
    known_coverage = (
        SkillCoverageResult(coverage=payload.skill_coverage)
        if payload.skill_coverage
        else None
    )
    return service.finalize_adaptation(
        payload.original_cv_structured,
        payload.job_structured,
        payload.approved_latent_skills,
        provider_context,
        known_coverage=known_coverage,
    )
