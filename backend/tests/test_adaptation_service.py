from unittest.mock import patch

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


def test_deep_mode_warns_when_coverage_analysis_could_not_run() -> None:
    """A failed coverage step used to be invisible: the wizard simply never
    opened, which reads as 'you have no transferable skills'."""
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
        required_skills=[JobSkill(name="Docker")],
        keywords_ats=["Docker"],
    )
    fake_adapt = {
        "adapted_summary": "Backend engineer",
        "adapted_experience": [
            {
                "company": "Acme",
                "title": "Backend Engineer",
                "rewritten_bullets": ["Shipped REST APIs on Docker."],
                "keywords_emphasized": ["docker"],
            }
        ],
        "added_keywords": ["docker"],
        "missing_skills": [],
        "latent_skills": [],
        "warnings": [],
    }

    with patch.object(service.coverage, "analyze", return_value=None):
        with patch.object(service.llm, "extract_json", return_value=fake_adapt):
            result = service.adapt_cv(
                cv, job, ProviderContext(provider="openai", model="gpt-4o-mini", api_key="sk-x"), mode="deep",
            )

    assert result.meta.strategy == "llm"
    assert any("no pudo completarse" in w for w in result.meta.warnings)


def test_fast_mode_does_not_warn_about_coverage() -> None:
    service = AdaptationService()
    cv = StructuredCV(experience=[CVExperience(company="Acme", title="Dev", bullets=["Built APIs."])])
    job = StructuredJob(required_skills=[JobSkill(name="Docker")])

    result = service.adapt_cv(
        cv, job, ProviderContext(provider="openai", model="gpt-4o-mini", api_key=None), mode="fast",
    )

    assert not any("no pudo completarse" in w for w in result.meta.warnings)


def test_normalize_marks_original_bullets_when_llm_omits_rewrite() -> None:
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

    result = service._normalize_llm_result(
        {
            "adapted_summary": "Updated summary",
            "adapted_experience": [{"company": "Acme", "title": "Backend Engineer", "rewritten_bullets": []}],
            "added_keywords": [],
            "missing_skills": [],
            "latent_skills": [],
            "warnings": [],
        },
        cv,
        job,
    )

    assert result["adapted_experience"][0]["rewritten_bullets"] == cv.experience[0].bullets
    assert result["adapted_experience"][0]["bullet_was_rewritten"] == [False]
