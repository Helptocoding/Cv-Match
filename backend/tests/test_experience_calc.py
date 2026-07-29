from datetime import date

from app.models.cv_schema import CVExperience, StructuredCV
from app.models.job_schema import JobSkill, RequiredExperience, StructuredJob
from app.utils.experience_calc import (
    _parse_month_year,
    calculate_relevant_years,
    calculate_total_years,
    evaluate_experience_requirement,
    merge_intervals,
)

TODAY = date(2026, 7, 26)

# ---------------------------------------------------------------------------
# _parse_month_year
# ---------------------------------------------------------------------------


def test_parse_yyyy_mm():
    assert _parse_month_year("2020-06") == date(2020, 6, 1)


def test_parse_mm_yyyy():
    assert _parse_month_year("06/2020") == date(2020, 6, 1)


def test_parse_mon_yyyy():
    assert _parse_month_year("Jan 2020") == date(2020, 1, 1)
    assert _parse_month_year("Ene 2020") == date(2020, 1, 1)


def test_parse_just_year():
    assert _parse_month_year("2020") == date(2020, 1, 1)


def test_parse_actualidad_returns_none():
    assert _parse_month_year("Actualidad") is None
    assert _parse_month_year("Present") is None


def test_parse_empty_returns_none():
    assert _parse_month_year("") is None


def test_parse_invalid_returns_none():
    assert _parse_month_year("not-a-date") is None


def test_parse_two_digit_year_rejected():
    """'20-06' must not be misread as year=20, month=06 (2006-01-01 land)."""
    assert _parse_month_year("20-06") is None


def test_parse_out_of_range_month_rejected():
    assert _parse_month_year("13/2020") is None


# ---------------------------------------------------------------------------
# merge_intervals
# ---------------------------------------------------------------------------


def test_merge_non_overlapping():
    intervals = [(date(2020, 1, 1), date(2020, 6, 1)),
                 (date(2021, 1, 1), date(2021, 6, 1))]
    merged = merge_intervals(intervals)
    assert merged == intervals


def test_merge_overlapping():
    intervals = [(date(2020, 1, 1), date(2020, 12, 1)),
                 (date(2020, 6, 1), date(2021, 6, 1))]
    merged = merge_intervals(intervals)
    assert merged == [(date(2020, 1, 1), date(2021, 6, 1))]


def test_merge_contained():
    intervals = [(date(2020, 1, 1), date(2021, 12, 1)),
                 (date(2020, 6, 1), date(2021, 1, 1))]
    merged = merge_intervals(intervals)
    assert merged == [(date(2020, 1, 1), date(2021, 12, 1))]


def test_merge_adjacent_touching():
    intervals = [(date(2020, 1, 1), date(2020, 6, 1)),
                 (date(2020, 6, 1), date(2020, 12, 1))]
    merged = merge_intervals(intervals)
    assert merged == [(date(2020, 1, 1), date(2020, 12, 1))]


def test_merge_empty():
    assert merge_intervals([]) == []


# ---------------------------------------------------------------------------
# calculate_total_years
# ---------------------------------------------------------------------------


def test_total_years_simple():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2022"),
    ]
    result = calculate_total_years(exps, TODAY)
    assert result is not None
    assert abs(result - 2.0) < 0.1


def test_total_years_ongoing():
    exps = [
        CVExperience(start_date="Jan 2024", end_date=""),
    ]
    result = calculate_total_years(exps, TODAY)
    assert result is not None
    assert abs(result - 2.5) < 0.2


def test_total_years_overlap_freelance():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2023"),
        CVExperience(start_date="Jun 2021", end_date="Jun 2022"),
    ]
    result = calculate_total_years(exps, TODAY)
    # Naive sum: 3 + 1 = 4.  Actual merged: Jan 2020 - Jan 2023 = ~3 years
    assert result is not None
    assert abs(result - 3.0) < 0.2
    assert result < 3.5  # must be less than naive sum


def test_total_years_gap_between_jobs():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2021"),
        CVExperience(start_date="Jan 2022", end_date="Jan 2023"),
    ]
    result = calculate_total_years(exps, TODAY)
    assert result is not None
    # 1 year + 1 year = 2, not 3 (gap doesn't count)
    assert abs(result - 2.0) < 0.2


def test_total_years_no_parsable_dates():
    exps = [
        CVExperience(start_date="", end_date=""),
        CVExperience(start_date="", end_date=""),
    ]
    result = calculate_total_years(exps, TODAY)
    assert result is None


def test_total_years_empty_list():
    assert calculate_total_years([], TODAY) is None


# ---------------------------------------------------------------------------
# calculate_relevant_years
# ---------------------------------------------------------------------------


def test_relevant_years_matches_technology():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2022",
                     technologies=["Python", "Docker"]),
    ]
    result = calculate_relevant_years(exps, {"python", "docker"}, TODAY)
    assert result is not None
    assert abs(result - 2.0) < 0.2


def test_relevant_years_no_match():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2022",
                     technologies=["Excel"]),
    ]
    result = calculate_relevant_years(exps, {"python", "docker"}, TODAY)
    assert result is None


def test_relevant_years_filters_non_matching():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2022",
                     technologies=["Python"]),
        CVExperience(start_date="Jan 2022", end_date="Jan 2024",
                     technologies=["Excel"]),
    ]
    result = calculate_relevant_years(exps, {"python"}, TODAY)
    assert result is not None
    assert abs(result - 2.0) < 0.2  # only first experience counts


def test_relevant_years_overlap_merged():
    exps = [
        CVExperience(start_date="Jan 2020", end_date="Jan 2023",
                     technologies=["Python"]),
        CVExperience(start_date="Jun 2021", end_date="Jun 2022",
                     technologies=["Python"]),
    ]
    result = calculate_relevant_years(exps, {"python"}, TODAY)
    assert result is not None
    assert abs(result - 3.0) < 0.2


# ---------------------------------------------------------------------------
# evaluate_experience_requirement — decision tree
# ---------------------------------------------------------------------------


def test_experience_no_numeric_requirement():
    """not_applicable when job doesn't specify min_years."""
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2020", end_date="Jan 2022"),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=0),
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "not_applicable"
    assert result.reason == "no_numeric_requirement"
    assert result.severity == "info"


def test_experience_meets_requirement():
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2019", end_date="Jan 2023"),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=2),
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "meets_requirement"
    assert result.reason == "ok"
    assert result.severity == "info"
    assert result.total_years_detected is not None
    assert result.total_years_detected >= 2.0


def test_experience_partial_match_below_threshold():
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2022", end_date="Jan 2024"),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=5),
        required_skills=[JobSkill(name="Python")],
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "partial_match"
    assert result.reason == "insufficient_years"
    # 2 years / 5 years = 0.4, below 0.75
    # must_have is True → blocker
    assert result.severity == "blocker"


def test_experience_partial_match_near_threshold():
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2019", end_date="Jan 2024"),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=6),
        required_skills=[JobSkill(name="Python")],
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    # 5 years / 6 years = 0.83, above 0.75
    assert result.reason == "insufficient_years"
    assert result.severity == "warning"


def test_experience_missing_or_unknown():
    cv = StructuredCV(experience=[
        CVExperience(start_date="", end_date=""),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=3),
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "missing_or_unknown"
    assert result.reason == "unparseable_dates"
    assert result.severity == "warning"


def test_experience_partial_dates_never_escalate_to_blocker():
    """One experience with a real date, one without: total_years is a lower
    bound, not proof the candidate falls short. Must be 'incomplete_dates',
    never a blocker, even though a numeric total_years exists."""
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2024", end_date="Jan 2025"),
        CVExperience(start_date="", end_date=""),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=8),
        required_skills=[JobSkill(name="Python", priority="must_have")],
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "missing_or_unknown"
    assert result.reason == "incomplete_dates"
    assert result.severity == "warning"
    assert result.dates_parsed == 1
    assert result.dates_total == 2


def test_experience_meets_years_but_irrelevant_domain_is_flagged():
    """14 years as a waiter clears a 5-year Kubernetes requirement on raw
    years alone. relevant_years must gate meets_requirement so this doesn't
    silently pass as a full match."""
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2010", end_date="Jan 2024", title="Camarero"),
    ])
    job = StructuredJob(
        required_experience=RequiredExperience(min_years=5),
        required_skills=[JobSkill(name="Kubernetes")],
    )
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "partial_match"
    assert result.reason == "experience_not_domain_relevant"
    assert result.relevant_years_detected is None


def test_experience_meets_requirement_without_job_terms_unaffected():
    """When the job has no skills/keywords to check relevance against,
    the relevance gate must not fire — this preserves prior behavior for
    jobs without structured skill data."""
    cv = StructuredCV(experience=[
        CVExperience(start_date="Jan 2019", end_date="Jan 2023"),
    ])
    job = StructuredJob(required_experience=RequiredExperience(min_years=2))
    result = evaluate_experience_requirement(cv, job, TODAY)
    assert result.status == "meets_requirement"
