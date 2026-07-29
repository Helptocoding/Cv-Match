from pydantic import BaseModel

from fastapi import APIRouter, Depends

from app.api.deps import ProviderContext, get_provider_context
from app.models.export_schema import AdaptedCV
from app.models.job_schema import StructuredJob
from app.models.scoring_schema import MatchScoreRequest, MatchScoreResult
from app.services.scoring_service import ScoringService


class ScoreAdaptedRequest(BaseModel):
    adapted_cv: AdaptedCV
    job_structured: StructuredJob


router = APIRouter()
service = ScoringService()


@router.post("/score/match", response_model=MatchScoreResult)
def score_match(
    payload: MatchScoreRequest,
    context: ProviderContext = Depends(get_provider_context),
) -> MatchScoreResult:
    return service.score_match(payload.cv_structured, payload.job_structured, context)


@router.post("/score/adapted", response_model=MatchScoreResult)
def score_adapted(
    payload: ScoreAdaptedRequest,
    context: ProviderContext = Depends(get_provider_context),
) -> MatchScoreResult:
    return service.score_adapted(payload.adapted_cv, payload.job_structured, context)
