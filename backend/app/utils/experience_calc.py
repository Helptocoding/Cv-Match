from datetime import date, datetime
from typing import Optional

from app.models.cv_schema import CVExperience


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------

_MONTH_MAP_ES = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}
_MONTH_MAP_EN = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_MAP = {**_MONTH_MAP_ES, **_MONTH_MAP_EN}

_MIN_YEAR = 1900
_MAX_YEAR = 2100


def _safe_date(year: int, month: int) -> Optional[date]:
    if _MIN_YEAR <= year <= _MAX_YEAR and 1 <= month <= 12:
        return date(year, month, 1)
    return None


def _parse_month_year(text: str) -> Optional[date]:
    raw = text.strip().lower()
    if not raw or raw in ("actualidad", "present", "now", "hoy", "current"):
        return None

    # "YYYY-MM" or "YYYY/MM"
    parts = raw.replace("/", "-").split("-")
    if len(parts) == 2:
        try:
            year = int(parts[0])
            month = int(parts[1])
            if (parsed := _safe_date(year, month)) is not None:
                return parsed
        except ValueError:
            pass
        try:
            year = int(parts[1])
            month = int(parts[0])
            if (parsed := _safe_date(year, month)) is not None:
                return parsed
        except ValueError:
            pass

    # "MM/YYYY"
    parts = raw.split("/")
    if len(parts) == 2:
        try:
            month = int(parts[0])
            year = int(parts[1])
            if (parsed := _safe_date(year, month)) is not None:
                return parsed
        except ValueError:
            pass

    # "Mon YYYY" or "YYYY"
    tokens = raw.split()
    year = None
    month = 1
    for token in tokens:
        token_clean = token.strip(",.")
        if token_clean.isdigit():
            year = int(token_clean)
        elif len(token_clean) >= 3 and token_clean[:3] in _MONTH_MAP:
            month = _MONTH_MAP[token_clean[:3]]
    if year is not None and (parsed := _safe_date(year, month)) is not None:
        return parsed

    return None


def _parse_interval(exp: CVExperience, today: Optional[date] = None) -> Optional[tuple[date, date]]:
    if today is None:
        today = date.today()
    start = _parse_month_year(exp.start_date)
    if start is None:
        return None
    end = _parse_month_year(exp.end_date)
    if end is None:
        end = today
    if end < start:
        end = start
    return (start, end)


# ---------------------------------------------------------------------------
# Interval merging
# ---------------------------------------------------------------------------

def merge_intervals(intervals: list[tuple[date, date]]) -> list[tuple[date, date]]:
    if not intervals:
        return []
    sorted_intervals = sorted(intervals, key=lambda x: x[0])
    merged: list[tuple[date, date]] = [sorted_intervals[0]]
    for start, end in sorted_intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _interval_days(intervals: list[tuple[date, date]]) -> float:
    return sum((end - start).days for start, end in intervals)


# ---------------------------------------------------------------------------
# Main calculations
# ---------------------------------------------------------------------------

def calculate_total_years(experiences: list[CVExperience], today: Optional[date] = None) -> Optional[float]:
    intervals = [
        interval for exp in experiences
        if (interval := _parse_interval(exp, today)) is not None
    ]
    if not intervals:
        return None
    merged = merge_intervals(intervals)
    return round(_interval_days(merged) / 365.25, 1)


def _date_coverage(experiences: list[CVExperience], today: Optional[date] = None) -> tuple[int, int]:
    """(experiences with a parseable start date, total experiences).

    Lets callers distinguish "candidate doesn't meet the requirement" from
    "we couldn't calculate it because some dates are missing/unparseable" —
    calculate_total_years alone conflates these once at least one date parses.
    """
    total = len(experiences)
    parsed = sum(1 for exp in experiences if _parse_interval(exp, today) is not None)
    return parsed, total


def evaluate_experience_requirement(
    cv,
    job,
    today: Optional[date] = None,
):
    from app.models.adaptation_schema import ExperienceRequirementCheck
    from app.models.cv_schema import StructuredCV
    from app.models.job_schema import StructuredJob
    from app.services.coverage_service import _build_job_terms

    required_years = float(job.required_experience.min_years) if job.required_experience.min_years else None
    is_qualitative = required_years is None

    if is_qualitative:
        return ExperienceRequirementCheck(
            required_years=None,
            is_qualitative_only=True,
            status="not_applicable",
            reason="no_numeric_requirement",
            severity="info",
        )

    total_years = calculate_total_years(cv.experience, today)
    job_terms = _build_job_terms(job)
    relevant_years = calculate_relevant_years(cv.experience, job_terms, today)
    dates_parsed, dates_total = _date_coverage(cv.experience, today)
    dates_incomplete = dates_total > 0 and dates_parsed < dates_total

    if total_years is None:
        return ExperienceRequirementCheck(
            required_years=required_years,
            is_qualitative_only=False,
            total_years_detected=None,
            relevant_years_detected=relevant_years,
            dates_parsed=dates_parsed,
            dates_total=dates_total,
            status="missing_or_unknown",
            reason="unparseable_dates",
            severity="warning",
        )

    # Some experiences had unparseable dates: total_years is a lower bound,
    # not a confirmed figure. Never treat a low bound as proof of failure.
    if dates_incomplete:
        return ExperienceRequirementCheck(
            required_years=required_years,
            is_qualitative_only=False,
            total_years_detected=total_years,
            relevant_years_detected=relevant_years,
            dates_parsed=dates_parsed,
            dates_total=dates_total,
            status="missing_or_unknown",
            reason="incomplete_dates",
            severity="warning",
        )

    if total_years >= required_years:
        # total_years counts every role regardless of domain. A candidate can
        # clear the bar on unrelated experience while having near-zero time
        # in anything the job actually asks for.
        if job_terms and (relevant_years is None or relevant_years < required_years * 0.5):
            return ExperienceRequirementCheck(
                required_years=required_years,
                is_qualitative_only=False,
                total_years_detected=total_years,
                relevant_years_detected=relevant_years,
                dates_parsed=dates_parsed,
                dates_total=dates_total,
                status="partial_match",
                reason="experience_not_domain_relevant",
                severity="warning",
            )
        return ExperienceRequirementCheck(
            required_years=required_years,
            is_qualitative_only=False,
            total_years_detected=total_years,
            relevant_years_detected=relevant_years,
            dates_parsed=dates_parsed,
            dates_total=dates_total,
            status="meets_requirement",
            reason="ok",
            severity="info",
        )

    ratio = total_years / required_years

    if ratio >= 0.75:
        return ExperienceRequirementCheck(
            required_years=required_years,
            is_qualitative_only=False,
            total_years_detected=total_years,
            relevant_years_detected=relevant_years,
            dates_parsed=dates_parsed,
            dates_total=dates_total,
            status="partial_match",
            reason="insufficient_years",
            severity="warning",
        )

    is_must_have = any(
        s.priority == "must_have" for s in job.required_skills
    )
    return ExperienceRequirementCheck(
        required_years=required_years,
        is_qualitative_only=False,
        total_years_detected=total_years,
        relevant_years_detected=relevant_years,
        dates_parsed=dates_parsed,
        dates_total=dates_total,
        status="partial_match",
        reason="insufficient_years",
        severity="blocker" if is_must_have else "warning",
    )


def calculate_relevant_years(
    experiences: list[CVExperience],
    job_terms: set[str],
    today: Optional[date] = None,
) -> Optional[float]:
    from app.services.coverage_service import _normalize_text

    intervals: list[tuple[date, date]] = []
    for exp in experiences:
        exp_text = " ".join(filter(None, [exp.title, *exp.bullets, *exp.technologies]))
        exp_tokens = _normalize_text(exp_text)
        if exp_tokens & job_terms:
            interval = _parse_interval(exp, today)
            if interval:
                intervals.append(interval)
    if not intervals:
        return None
    merged = merge_intervals(intervals)
    return round(_interval_days(merged) / 365.25, 1)
