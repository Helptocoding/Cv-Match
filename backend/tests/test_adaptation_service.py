from app.api.deps import ProviderContext
from app.models.cv_schema import CVExperience, StructuredCV
from app.models.job_schema import JobSkill, StructuredJob
from app.services.adaptation_service import AdaptationService


def test_adaptation_fallback_sets_metadata_and_keywords() -> None:
    service = AdaptationService()
    cv = StructuredCV(
        summary="Backend engineer with API and Docker experience.",
        experience=[
            CVExperience(
                company="Acme",
                title="Backend Engineer",
                bullets=["Built REST APIs with Docker deployments."],
            )
        ],
    )
    job = StructuredJob(
        required_skills=[JobSkill(name="Docker"), JobSkill(name="REST")],
        keywords_ats=["Docker", "REST"],
    )

    result = service.adapt_cv(cv, job, ProviderContext(provider="openai", model="gpt-4o-mini", api_key=None))

    assert result.meta.strategy == "heuristic"
    assert "docker" in result.added_keywords
    assert result.source_cv is not None
