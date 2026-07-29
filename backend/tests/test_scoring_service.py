from unittest.mock import patch

from app.api.deps import ProviderContext
from app.models.cv_schema import CVExperience, CVSkill, StructuredCV
from app.models.job_schema import JobSkill, RequiredExperience, StructuredJob
from app.services.scoring_service import ScoringService


def test_score_match_returns_high_skill_alignment() -> None:
    service = ScoringService()
    cv = StructuredCV(
        skills=[CVSkill(name="Python"), CVSkill(name="FastAPI"), CVSkill(name="Docker")],
        experience=[CVExperience(title="Backend Engineer", duration_months=48)],
        keywords=["REST", "Postgres"],
    )
    job = StructuredJob(
        required_skills=[JobSkill(name="Python"), JobSkill(name="FastAPI")],
        required_experience=RequiredExperience(min_years=3),
        keywords_ats=["REST", "Docker"],
    )

    result = service.score_match(cv, job, ProviderContext(provider="", model="", api_key=None))

    assert result.score > 70
    assert result.compatibility == "alta"


def test_llm_path_caps_score_when_experience_requirement_unmet() -> None:
    """The LLM can misjudge or ignore a hard years-of-experience gap.
    _apply_experience_check must override an inflated score with the
    deterministic date calculation, same as the heuristic fallback does."""
    service = ScoringService()
    cv = StructuredCV(
        skills=[CVSkill(name="Python")],
        experience=[CVExperience(title="Junior Dev", start_date="Jan 2024", end_date="Jan 2025")],
    )
    job = StructuredJob(
        required_skills=[JobSkill(name="Python", priority="must_have")],
        required_experience=RequiredExperience(min_years=8),
    )
    fake_llm_result = {
        "score": 90,
        "compatibility": "alta",
        "summary": "great fit",
        "strengths": [],
        "gaps": [],
        "transferable_skills": [],
        "recommendations": [],
    }
    with patch.object(service.llm, "extract_json", return_value=fake_llm_result):
        result = service.score_match(cv, job, ProviderContext(provider="openai", model="gpt-4o-mini", api_key="x"))

    assert result.score <= 40
    assert result.compatibility == "baja"
    assert any("experien" in gap.area.lower() for gap in result.gaps)


def test_llm_path_leaves_score_alone_when_experience_requirement_met() -> None:
    service = ScoringService()
    cv = StructuredCV(
        skills=[CVSkill(name="Python")],
        experience=[CVExperience(title="Senior Dev", start_date="Jan 2015", end_date="Jan 2025")],
    )
    job = StructuredJob(
        required_skills=[JobSkill(name="Python", priority="must_have")],
        required_experience=RequiredExperience(min_years=3),
    )
    fake_llm_result = {
        "score": 80,
        "compatibility": "alta",
        "summary": "great fit",
        "strengths": [],
        "gaps": [],
        "transferable_skills": [],
        "recommendations": [],
    }
    with patch.object(service.llm, "extract_json", return_value=fake_llm_result):
        result = service.score_match(cv, job, ProviderContext(provider="openai", model="gpt-4o-mini", api_key="x"))

    assert result.score == 80
