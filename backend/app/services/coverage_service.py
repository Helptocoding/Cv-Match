import json
import logging
import re
import unicodedata
from pathlib import Path

from typing import TYPE_CHECKING

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.adaptation_schema import (
    AdaptationImpact,
    LatentProposal,
    SkillCoverageItem,
    SkillCoverageResult,
)
from app.models.cv_schema import StructuredCV
from app.models.job_schema import StructuredJob
from app.services.llm_client import LLMClient

if TYPE_CHECKING:  # export_schema imports nothing from here at runtime
    from app.models.export_schema import AdaptedCV


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"

# ---------------------------------------------------------------------------
# Lightweight text normalization for Spanish/English
# ---------------------------------------------------------------------------

STOPWORDS = frozenset({
    # es
    "de", "del", "la", "las", "el", "los", "le", "les", "lo", "y", "e",
    "en", "con", "para", "por", "una", "un", "unos", "unas", "que",
    "sobre", "al", "a", "su", "sus", "se", "no", "es", "fue", "era",
    "como", "mas", "pero", "entre", "cada", "sin",
    # en
    "the", "and", "of", "for", "with", "to", "in", "on", "a", "an",
    "is", "was", "are", "were", "been", "be", "has", "have", "had",
    "its", "it", "at", "by", "from", "or", "as", "but", "not",
})

PROTECTED_TERMS = frozenset({
    "sql", "etl", "api", "apis", "aws", "gcp", "azure", "qa", "ci",
    "cd", "ci/cd", "airflow", "docker", "kubernetes", "k8s",
    "terraform", "react", "fastapi", "html", "css", "js", "ts",
    "node", "python", "java", "go", "rust", "php", "ruby",
})

DIRECT_ALIASES = {
    # Each entry maps a skill name → set of DIRECT synonym tokens.
    # These must be conservative: only tokens that directly express the SAME
    # skill, not loosely related terms.  "any()" logic is used at lookup,
    # so entries must be precise enough that a single matching token is
    # sufficient to call the skill explicit.
    "optimizacion del rendimiento": {"performance", "optimizacion", "optimiz", "rendi"},
    "optimizacion": {"optimiz"},
    "data engineering": {"etl", "airflow"},
    "software engineering": {"arquitectura", "scalability", "escalabilidad"},
    "cross-browser testing": {"cross-browser", "browser", "navegadores"},
    "stakeholder management": {"stakeholder", "stakeholders"},
    "regression testing": {"regression", "regresion"},
    "manual testing": {"manual testing", "manual"},
    "ci/cd": {"ci", "cd"},
}


def _strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _stem_token(token: str) -> str:
    """Light stemmer for Spanish/English. Applies suffix reduction before plural removal."""

    if token in PROTECTED_TERMS:
        return token

    if len(token) <= 3:
        return token

    # Suffix list: longer/greedier first
    suffixes = [
        "adores", "adoras",  # -ador forms
        "aciones", "acion",  # -ación
        "amientos", "amiento",  # -amiento
        "imientos", "imiento",  # -imiento
        "mientos", "miento",
        "adoras", "adora", "adores", "ador",
        "ciones", "cion",
        "idades", "idad",
        "mente",
        "ando", "iendo",
        "ados", "adas", "ado", "ada",
        "idos", "idas", "ido", "ida",
        "ars", "ers", "irs",
        "ar", "er", "ir",
        "ings", "ing",
        "tions", "tion",
        "eds", "ed",
        "ers", "er",
    ]

    for suffix in suffixes:
        if len(token) > len(suffix) + 2 and token.endswith(suffix):
            return token[: -len(suffix)]

    # Plural removal as fallback (only if no suffix matched)
    if len(token) > 4 and token.endswith("s"):
        token = token[:-1]

    return token


def _normalize_text(text: str) -> set[str]:
    text = text.lower()
    text = _strip_accents(text)
    text = re.sub(r"[^a-z0-9+/#.\-\s]", " ", text)
    raw_tokens = text.split()

    result: set[str] = set()
    for token in raw_tokens:
        if token in STOPWORDS:
            continue
        if len(token) <= 2 and token not in PROTECTED_TERMS:
            continue
        result.add(_stem_token(token))
    return result


def _normalize_skill_key(key: str) -> str:
    return _strip_accents(key.lower().strip())


def _collect_cv_text(cv: StructuredCV) -> str:
    parts: list[str] = []

    if cv.summary:
        parts.append(cv.summary)

    for skill in cv.skills:
        parts.append(skill.name)

    for exp in cv.experience:
        parts.extend(exp.bullets)
        parts.extend(exp.achievements)
        parts.extend(exp.technologies)
        parts.append(exp.title)
        parts.append(exp.company)

    for project in cv.projects:
        parts.append(project.name)
        parts.append(project.description)
        parts.extend(project.technologies)

    parts.extend(cv.keywords)

    return "\n".join(p for p in parts if p)


def _build_job_terms(job: StructuredJob) -> set[str]:
    terms: set[str] = set()

    for skill in job.required_skills:
        terms |= _normalize_text(skill.name)

    for skill in job.preferred_skills:
        terms |= _normalize_text(skill.name)

    for kw in job.keywords_ats:
        terms |= _normalize_text(kw)

    for tool in job.tools_and_technologies:
        terms |= _normalize_text(tool)

    return terms


def _is_explicit_match(skill: str, evidence: str, cv_text: str) -> tuple[bool, str | None]:
    """Check whether a skill is already explicit in the CV or evidence.

    Returns (is_explicit, reason).
    - explicit means: skill or alias present literally in CV,
      OR majority of skill tokens overlap with evidence tokens.
    """
    skill_tokens = _normalize_text(skill)
    cv_tokens = _normalize_text(cv_text)
    evidence_tokens = _normalize_text(evidence)

    # 1. Skill tokens present in CV text (literal or stemmed)
    if skill_tokens and skill_tokens <= cv_tokens:
        return True, "explicit_skill_tokens"

    # 2. Alias match (lookup by normalized key)
    normalized_key = _normalize_skill_key(skill)
    for alias_key, alias_tokens in DIRECT_ALIASES.items():
        if normalized_key == alias_key or normalized_key in alias_key or alias_key in normalized_key:
            if alias_tokens and any(t in cv_tokens for t in alias_tokens):
                return True, "explicit_alias_match"

    # 3. Majority overlap with evidence
    if skill_tokens and evidence_tokens:
        overlap = len(skill_tokens & evidence_tokens) / len(skill_tokens)
        if overlap > 0.5:
            return True, "explicit_in_evidence"

    return False, None


def _has_added_vocabulary(
    skill: str,
    evidence: str,
    suggested_phrase: str,
    job_terms: set[str],
) -> bool:
    """Check whether the suggested_phrase introduces job-relevant vocabulary
    that was not already present in the evidence.

    This is the key guard against paraphrase noise: a latent proposal must
    add value aligned with the target vacancy, not just rephrase the evidence.
    """
    suggested_tokens = _normalize_text(suggested_phrase)
    evidence_tokens = _normalize_text(evidence)
    skill_tokens = _normalize_text(skill)

    # Tokens that the suggested phrase introduces (not in evidence)
    new_tokens = suggested_tokens - evidence_tokens

    # Value exists if it adds job-relevant vocabulary
    value_tokens = new_tokens & job_terms
    if value_tokens:
        # If the only "new" tokens are the skill name being restated
        # (e.g. stem mismatch: "optimice" vs "optimiz") AND the evidence
        # already partially conveys the skill concept, it's paraphrase not value.
        if value_tokens <= skill_tokens and (skill_tokens & evidence_tokens):
            return False
        return True

    # Fallback: if the phrase introduces the target skill vocabulary
    # and that vocabulary was not already in the evidence
    if (skill_tokens & suggested_tokens) and not (skill_tokens & evidence_tokens):
        return True

    return False


def _evidence_supported(evidence: str, cv_text: str) -> bool:
    """Check whether the LLM's cited 'evidence' actually appears in the CV.

    The LLM is asked to quote the CV directly, but nothing stops it from
    paraphrasing or inventing a plausible-sounding quote. Without this check
    a fabricated evidence string sails through the rest of the post-check
    and can even get *promoted* to explicit_match.
    """
    ev_tokens = _normalize_text(evidence)
    if not ev_tokens:
        return False
    cv_tokens = _normalize_text(cv_text)
    return len(ev_tokens & cv_tokens) / len(ev_tokens) >= 0.8


def _post_validate_coverage_item(
    item: SkillCoverageItem,
    cv_text: str,
    job_terms: set[str],
) -> tuple[SkillCoverageItem, str | None]:
    """Post-check: demote fake latent_match items based on deterministic rules.

    This corrects LLM over-classification of explicit content as latent.
    It does NOT validate overclaiming (aggressive reframing beyond what
    evidence supports) — that is left to human approval in the wizard.
    """
    if item.status != "latent_match" and item.status != "explicit_match":
        return item, None

    if item.evidence.strip() and cv_text and not _evidence_supported(item.evidence, cv_text):
        item.status = "missing"
        item.evidence = ""
        item.suggested_phrase = ""
        return item, "evidence_not_in_cv"

    is_explicit, explicit_reason = _is_explicit_match(item.skill, item.evidence, cv_text)
    if is_explicit:
        item.status = "explicit_match"
        item.suggested_phrase = ""
        return item, explicit_reason

    # If already explicit_match from LLM, no further work
    if item.status == "explicit_match":
        return item, None

    # Must have evidence to be latent
    if not item.evidence.strip():
        item.status = "missing"
        item.suggested_phrase = ""
        return item, "insufficient_evidence"

    # Must add job-relevant vocabulary to be truly latent
    if not _has_added_vocabulary(item.skill, item.evidence, item.suggested_phrase, job_terms):
        evidence_tokens = _normalize_text(item.evidence)
        skill_tokens = _normalize_text(item.skill)
        if skill_tokens & evidence_tokens:
            # Evidence partially covers the skill concept — degrade to explicit
            item.status = "explicit_match"
            item.suggested_phrase = ""
            return item, "paraphrase_detected"

        # No shared vocabulary and no job-relevant new vocabulary detected —
        # but this check is lexical (stemmed token overlap) and blind to
        # cross-language/synonym translation it can't verify either way.
        # Downgrading straight to "missing" here would silently delete a
        # real skill the LLM found and the candidate has evidence for; we
        # have real, human-verified evidence (checked above), so leave the
        # classification as-is and flag it for wizard review instead.
        return item, "low_confidence_kept_latent"

    return item, None


# ---------------------------------------------------------------------------
# Deterministic adaptation impact
# ---------------------------------------------------------------------------

def _collect_adapted_text(source_cv: StructuredCV, adapted: "AdaptedCV") -> str:
    """Same surface as _collect_cv_text, but with the adapted summary and the
    rewritten bullets in place of the originals."""
    parts: list[str] = []

    if adapted.adapted_summary:
        parts.append(adapted.adapted_summary)

    for skill in source_cv.skills:
        parts.append(skill.name)

    for exp in adapted.adapted_experience:
        parts.extend(exp.rewritten_bullets)
        parts.append(exp.title)
        parts.append(exp.company)

    # Carried over untouched by the adaptation, so still valid evidence.
    for exp in source_cv.experience:
        parts.extend(exp.achievements)
        parts.extend(exp.technologies)

    for project in source_cv.projects:
        parts.append(project.name)
        parts.append(project.description)
        parts.extend(project.technologies)

    parts.extend(source_cv.keywords)

    return "\n".join(p for p in parts if p)


def compute_adaptation_impact(
    source_cv: StructuredCV,
    adapted: "AdaptedCV",
    job: StructuredJob,
) -> AdaptationImpact:
    """Classify every vacancy skill as newly covered / already covered / still
    missing, by running the same lexical matcher against the CV before and
    after adaptation.

    No LLM call: this is the reproducible counterpart to the score delta.
    """
    before_text = _collect_cv_text(source_cv)
    after_text = _collect_adapted_text(source_cv, adapted)

    newly: list[str] = []
    already: list[str] = []
    still_missing: list[str] = []

    seen: set[str] = set()
    for skill in list(job.required_skills) + list(job.preferred_skills):
        name = skill.name.strip()
        key = _normalize_skill_key(name)
        if not name or key in seen:
            continue
        seen.add(key)

        was_covered, _ = _is_explicit_match(name, "", before_text)
        is_covered, _ = _is_explicit_match(name, "", after_text)

        if was_covered:
            already.append(name)
        elif is_covered:
            newly.append(name)
        else:
            still_missing.append(name)

    bullets_total = 0
    bullets_rewritten = 0
    for exp in adapted.adapted_experience:
        bullets_total += len(exp.rewritten_bullets)
        # bullet_was_rewritten is positional; treat a missing flag as unchanged
        # rather than assuming a rewrite happened.
        bullets_rewritten += sum(
            1 for i in range(len(exp.rewritten_bullets))
            if i < len(exp.bullet_was_rewritten) and exp.bullet_was_rewritten[i]
        )

    return AdaptationImpact(
        skills_newly_covered=newly,
        skills_already_covered=already,
        skills_still_missing=still_missing,
        bullets_total=bullets_total,
        bullets_rewritten=bullets_rewritten,
    )


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class CoverageService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        self.llm.stage = "coverage_analysis"

    def analyze(self, cv: StructuredCV, job: StructuredJob, context: ProviderContext) -> SkillCoverageResult | None:
        prompt = (PROMPTS_DIR / "coverage_analysis.md").read_text(encoding="utf-8")
        payload = json.dumps(
            {
                "source_cv": cv.model_dump(mode="json"),
                "job": job.model_dump(mode="json"),
            },
            ensure_ascii=True,
        )
        try:
            result = self.llm.extract_json(prompt, payload, context)
            return self._normalize_with_context(result, cv, job) if result else None
        except (ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError):
            return None

    # -- public wrapper for backward compat --
    def _normalize(self, result: dict) -> SkillCoverageResult:
        return self._normalize_with_context(result, None, None)

    def _normalize_with_context(
        self,
        result: dict,
        cv: StructuredCV | None,
        job: StructuredJob | None,
    ) -> SkillCoverageResult:
        coverage: list[SkillCoverageItem] = []
        proposals: list[LatentProposal] = []

        cv_text = _collect_cv_text(cv) if cv else ""
        job_terms = _build_job_terms(job) if job else set()
        demotion_stats: dict[str, int] = {}

        for item in result.get("coverage", []):
            if not isinstance(item, dict):
                continue
            skill = str(item.get("skill", "")).strip()
            if not skill:
                continue
            status = str(item.get("status", "missing")).strip()
            if status not in ("explicit_match", "latent_match", "missing"):
                status = "missing"
            evidence = str(item.get("evidence", "")).strip()
            suggested = str(item.get("suggested_phrase", "")).strip()

            parsed = SkillCoverageItem(
                skill=skill,
                status=status,
                evidence=evidence,
                suggested_phrase=suggested,
            )

            if cv and job:
                parsed, reason = _post_validate_coverage_item(parsed, cv_text, job_terms)
                if reason:
                    demotion_stats[reason] = demotion_stats.get(reason, 0) + 1

            coverage.append(parsed)

            if parsed.status == "latent_match" and parsed.evidence:
                proposals.append(
                    LatentProposal(
                        skill=parsed.skill,
                        evidence=parsed.evidence,
                        suggested_phrase=parsed.suggested_phrase,
                    )
                )

        if demotion_stats:
            logger.info("coverage_postcheck demotions: %s", demotion_stats)

        return SkillCoverageResult(coverage=coverage, proposals=proposals)
