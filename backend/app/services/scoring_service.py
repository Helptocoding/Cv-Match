import json
from pathlib import Path

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.cv_schema import StructuredCV
from app.models.job_schema import StructuredJob
from app.models.scoring_schema import (
    CompatibilityGap,
    CompatibilityStrength,
    MatchScoreResult,
    TransferableSkill,
)
from app.services.llm_client import LLMClient
from app.utils.keyword_utils import normalize_keywords


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"


class ScoringService:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def score_match(self, cv: StructuredCV, job: StructuredJob, context: ProviderContext) -> MatchScoreResult:
        prompt = (PROMPTS_DIR / "score_cv.md").read_text(encoding="utf-8")
        llm_result, warnings = self._try_llm(prompt, cv, job, context)
        if llm_result:
            return self._normalize_llm_result(llm_result, warnings)
        return self._heuristic_fallback(cv, job, warnings)

    def _normalize_llm_result(self, result: dict, warnings: list[str]) -> MatchScoreResult:
        raw_score = result.get("score", None)
        try:
            score = max(0, min(100, int(raw_score)))
        except (TypeError, ValueError):
            score = None

        compatibility = str(result.get("compatibility", "media")).lower()
        if compatibility not in ("alta", "media", "baja"):
            compatibility = "media"

        # derive compatibility from score if LLM omitted it or it conflicts
        if score is not None:
            if score >= 65:
                compatibility = "alta"
            elif score >= 45:
                compatibility = "media"
            else:
                compatibility = "baja"
        elif compatibility == "alta":
            score = 75
        elif compatibility == "baja":
            score = 30
        else:
            score = 55

        strengths = [
            CompatibilityStrength(
                area=str(item.get("area", "")).strip(),
                explanation=str(item.get("explanation", "")).strip(),
            )
            for item in result.get("strengths", [])
            if isinstance(item, dict) and item.get("area")
        ]

        gaps = [
            CompatibilityGap(
                area=str(item.get("area", "")).strip(),
                severity=str(item.get("severity", "superable")).lower(),
                explanation=str(item.get("explanation", "")).strip(),
                bridge=str(item.get("bridge", "")).strip(),
            )
            for item in result.get("gaps", [])
            if isinstance(item, dict) and item.get("area")
        ]

        transferable = [
            TransferableSkill(
                skill=str(item.get("skill", "")).strip(),
                context=str(item.get("context", "")).strip(),
            )
            for item in result.get("transferable_skills", [])
            if isinstance(item, dict) and item.get("skill")
        ]

        recommendations = [str(r).strip() for r in result.get("recommendations", []) if str(r).strip()]

        return MatchScoreResult(
            score=score,
            compatibility=compatibility,
            summary=str(result.get("summary", "")).strip(),
            strengths=strengths,
            gaps=gaps,
            transferable_skills=transferable,
            recommendations=recommendations,
            strategy="llm",
        )

    def _heuristic_fallback(self, cv: StructuredCV, job: StructuredJob, warnings: list[str]) -> MatchScoreResult:
        cv_skills = set(normalize_keywords([skill.name for skill in cv.skills] + cv.keywords))
        job_required = set(normalize_keywords([skill.name for skill in job.required_skills]))
        job_keywords = set(normalize_keywords(job.keywords_ats + job.tools_and_technologies))
        all_job = job_required | job_keywords

        matched = cv_skills & all_job
        missing = all_job - cv_skills

        strengths: list[CompatibilityStrength] = []
        if matched:
            strengths.append(CompatibilityStrength(
                area="Habilidades coincidentes",
                explanation=f"Se encontraron en el CV: {', '.join(sorted(matched)[:6])}.",
            ))

        years_available = sum(e.duration_months for e in cv.experience) / 12 if cv.experience else 0
        if years_available > 0:
            strengths.append(CompatibilityStrength(
                area="Experiencia acumulada",
                explanation=f"Aproximadamente {years_available:.1f} años de experiencia registrada.",
            ))

        gaps: list[CompatibilityGap] = []
        for skill in sorted(missing)[:6]:
            gaps.append(CompatibilityGap(
                area=skill,
                severity="superable",
                explanation=f"'{skill}' requerido por la vacante no fue encontrado explícitamente en el CV.",
                bridge="Revisá si tenés experiencia relacionada que no está nombrada con este término exacto.",
            ))

        if job_required and not matched:
            compat = "baja"
            ratio = 0.0
        elif not all_job:
            compat = "media"
            ratio = 0.5
        else:
            ratio = len(matched & job_required) / len(job_required) if job_required else 1.0
            compat = "alta" if ratio >= 0.65 else ("media" if ratio >= 0.35 else "baja")

        heuristic_score = max(0, min(100, int(ratio * 100)))

        summary_parts = [f"Análisis heurístico (sin IA)."]
        if warnings:
            summary_parts.append(warnings[0])
        if matched:
            summary_parts.append(f"Se detectaron {len(matched)} coincidencias directas de habilidades.")
        if missing:
            summary_parts.append(f"Hay {len(missing)} términos de la vacante no encontrados textualmente en el CV — puede tratarse de sinónimos o habilidades no mencionadas.")

        recommendations: list[str] = []
        if missing:
            recommendations.append(f"Verificá si tenés experiencia con: {', '.join(sorted(missing)[:3])} — puede que uses otro nombre.")
        if years_available < (job.required_experience.min_years or 0):
            recommendations.append(f"La vacante pide {job.required_experience.min_years} años. Asegurate de que las fechas de experiencia estén completas en el CV.")

        return MatchScoreResult(
            score=heuristic_score,
            compatibility=compat,
            summary=" ".join(summary_parts),
            strengths=strengths,
            gaps=gaps,
            transferable_skills=[],
            recommendations=recommendations,
            strategy="heuristic",
        )

    def _try_llm(
        self,
        prompt: str,
        cv: StructuredCV,
        job: StructuredJob,
        context: ProviderContext,
    ) -> tuple[dict | None, list[str]]:
        payload = json.dumps(
            {
                "source_cv": cv.model_dump(mode="json"),
                "job": job.model_dump(mode="json"),
            },
            ensure_ascii=True,
        )
        try:
            return self.llm.extract_json(prompt, payload, context), []
        except ProviderConfigurationError as exc:
            return None, [str(exc)]
        except (ProviderRequestError, ProviderResponseFormatError) as exc:
            return None, [f"Se activó fallback heurístico: {exc}"]
