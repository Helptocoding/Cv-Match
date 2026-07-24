from app.models.cv_schema import CVExperience, CVSkill, StructuredCV
from app.models.job_schema import JobSkill, RequiredExperience, StructuredJob
from app.models.scoring_schema import ScoreWeights
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

    result = service.score_match(cv, job, ScoreWeights())

    assert result.overall_score >= 75
    assert "python" in result.category_scores["skills"].matched
