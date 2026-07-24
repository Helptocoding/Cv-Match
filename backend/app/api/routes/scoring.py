from fastapi import APIRouter, Depends

from app.api.deps import ProviderContext, get_provider_context
from app.models.scoring_schema import MatchScoreRequest, MatchScoreResult
from app.services.scoring_service import ScoringService


router = APIRouter()
service = ScoringService()


@router.post("/score/match", response_model=MatchScoreResult)
def score_match(
    payload: MatchScoreRequest,
    context: ProviderContext = Depends(get_provider_context),
) -> MatchScoreResult:
    return service.score_match(payload.cv_structured, payload.job_structured, context)
