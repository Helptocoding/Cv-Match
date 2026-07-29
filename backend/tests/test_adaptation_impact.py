from app.models.cv_schema import CVBasics, CVExperience, CVSkill, StructuredCV
from app.models.export_schema import AdaptedCV, AdaptedExperience
from app.models.job_schema import JobSkill, StructuredJob
from app.services.coverage_service import compute_adaptation_impact


def _cv() -> StructuredCV:
    return StructuredCV(
        basics=CVBasics(full_name="Ana Garcia"),
        summary="Frontend developer building React applications.",
        skills=[CVSkill(name="React"), CVSkill(name="Jest")],
        experience=[
            CVExperience(
                company="TechCorp",
                title="Frontend Developer",
                start_date="2020-01",
                end_date="2024-01",
                bullets=["Developed React components with unit tests using Jest."],
                technologies=["React", "Jest"],
            )
        ],
    )


def _job() -> StructuredJob:
    return StructuredJob(
        job_title="QA Engineer",
        required_skills=[
            JobSkill(name="React", priority="must_have"),
            JobSkill(name="regression testing", priority="must_have"),
            JobSkill(name="Selenium", priority="must_have"),
        ],
    )


def test_classifies_already_newly_and_still_missing():
    cv = _cv()
    adapted = AdaptedCV(
        adapted_summary="QA-oriented engineer.",
        adapted_experience=[
            AdaptedExperience(
                company="TechCorp",
                title="Frontend Developer",
                # introduces "regression testing" vocabulary, never Selenium
                rewritten_bullets=["Ran regression testing over React components using Jest."],
                bullet_was_rewritten=[True],
            )
        ],
        source_cv=cv,
    )

    impact = compute_adaptation_impact(cv, adapted, _job())

    assert "React" in impact.skills_already_covered
    assert "regression testing" in impact.skills_newly_covered
    assert "Selenium" in impact.skills_still_missing


def test_is_deterministic_across_repeated_calls():
    cv, job = _cv(), _job()
    adapted = AdaptedCV(
        adapted_summary="QA-oriented engineer.",
        adapted_experience=[
            AdaptedExperience(
                company="TechCorp", title="Frontend Developer",
                rewritten_bullets=["Ran regression testing over React components."],
                bullet_was_rewritten=[True],
            )
        ],
        source_cv=cv,
    )
    first = compute_adaptation_impact(cv, adapted, job)
    for _ in range(5):
        assert compute_adaptation_impact(cv, adapted, job) == first


def test_bullet_counts_treat_missing_flags_as_unchanged():
    cv = _cv()
    adapted = AdaptedCV(
        adapted_experience=[
            AdaptedExperience(
                company="TechCorp", title="Frontend Developer",
                rewritten_bullets=["a", "b", "c"],
                bullet_was_rewritten=[True],  # shorter than bullets on purpose
            )
        ],
        source_cv=cv,
    )
    impact = compute_adaptation_impact(cv, adapted, _job())
    assert impact.bullets_total == 3
    assert impact.bullets_rewritten == 1


def test_skill_listed_twice_in_vacancy_counted_once():
    cv = _cv()
    job = StructuredJob(
        job_title="QA Engineer",
        required_skills=[JobSkill(name="Selenium", priority="must_have")],
        preferred_skills=[JobSkill(name="selenium")],
    )
    adapted = AdaptedCV(
        adapted_experience=[
            AdaptedExperience(
                company="TechCorp", title="Frontend Developer",
                rewritten_bullets=["Developed React components."],
                bullet_was_rewritten=[False],
            )
        ],
        source_cv=cv,
    )
    impact = compute_adaptation_impact(cv, adapted, job)
    everything = (
        impact.skills_newly_covered
        + impact.skills_already_covered
        + impact.skills_still_missing
    )
    assert len(everything) == 1
