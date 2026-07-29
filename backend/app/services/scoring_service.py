import json
from pathlib import Path

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.cv_schema import CVBasics, CVExperience, CVSkill, StructuredCV
from app.models.export_schema import AdaptedCV
from app.models.job_schema import StructuredJob
from app.models.adaptation_schema import ExperienceRequirementCheck
from app.models.scoring_schema import (
    CompatibilityGap,
    CompatibilityStrength,
    MatchScoreResult,
    TransferableSkill,
)
from app.services.llm_client import LLMClient
from app.utils.experience_calc import evaluate_experience_requirement
from app.utils.keyword_utils import normalize_keywords


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"


class ScoringService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        self.llm.stage = "score"

    def score_match(self, cv: StructuredCV, job: StructuredJob, context: ProviderContext) -> MatchScoreResult:
        prompt = (PROMPTS_DIR / "score_cv.md").read_text(encoding="utf-8")
        llm_result, warnings = self._try_llm(prompt, cv, job, context)
        if llm_result:
            result = self._normalize_llm_result(llm_result, warnings)
            return self._apply_experience_check(result, cv, job)
        return self._heuristic_fallback(cv, job, warnings)

    def _apply_experience_check(
        self, result: MatchScoreResult, cv: StructuredCV, job: StructuredJob,
    ) -> MatchScoreResult:
        """Years-of-experience is an objective date calculation — never trust
        the LLM's judgment on it alone. This overrides/augments whatever the
        LLM produced with the deterministic check, the same one the heuristic
        fallback already relies on.
        """
        exp_check: ExperienceRequirementCheck = evaluate_experience_requirement(cv, job)

        has_exp_gap = any("experien" in gap.area.lower() for gap in result.gaps)

        if exp_check.status == "meets_requirement" or exp_check.status == "not_applicable":
            return result

        if exp_check.reason == "unparseable_dates" or exp_check.reason == "incomplete_dates":
            if not has_exp_gap:
                result.gaps.append(CompatibilityGap(
                    area="Experiencia requerida",
                    severity="warning",
                    explanation="No pudimos calcular tus años de experiencia con certeza: faltan fechas en tu CV.",
                    bridge="Completá las fechas de inicio y fin de cada experiencia en tu CV.",
                ))
            return result

        if not has_exp_gap:
            gap_detail = f"Experiencia requerida: {exp_check.required_years:.0f} años"
            if exp_check.total_years_detected is not None:
                gap_detail += f" · Detectada: {exp_check.total_years_detected:.1f} años"
            result.gaps.append(CompatibilityGap(
                area="Experiencia requerida",
                severity=exp_check.severity,
                explanation=gap_detail,
                bridge="Considerá destacar proyectos o roles donde adquiriste experiencia relevante.",
            ))

        if exp_check.severity == "blocker" and result.score > 40:
            result.score = 40
            result.compatibility = "baja"

        return result

    def _normalize_llm_result(self, result: dict, warnings: list[str]) -> MatchScoreResult:
        raw_score = result.get("score", None)
        if isinstance(raw_score, (int, float, str)):
            try:
                score = max(0, min(100, int(raw_score)))
            except (TypeError, ValueError):
                score = None
        else:
            score = None

        compatibility = str(result.get("compatibility", "media")).lower()
        if compatibility not in ("alta", "media", "baja"):
            compatibility = "media"

        # derive compatibility from score if LLM omitted it or it conflicts
        if score is not None:
            if score > 70:
                compatibility = "alta"
            elif score > 50:
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

        # -- experience requirement check --
        exp_check: ExperienceRequirementCheck = evaluate_experience_requirement(cv, job)

        if exp_check.total_years_detected and exp_check.total_years_detected > 0:
            exp_detail = f"Aproximadamente {exp_check.total_years_detected:.1f} años de experiencia"
            if (exp_check.relevant_years_detected is not None
                    and exp_check.relevant_years_detected != exp_check.total_years_detected):
                exp_detail += f" ({exp_check.relevant_years_detected:.1f} relevantes para este rol)"
            strengths.append(CompatibilityStrength(
                area="Experiencia acumulada",
                explanation=exp_detail,
            ))

        gaps: list[CompatibilityGap] = []
        for skill in sorted(missing)[:6]:
            gaps.append(CompatibilityGap(
                area=skill,
                severity="superable",
                explanation=f"'{skill}' requerido por la vacante no fue encontrado explícitamente en el CV.",
                bridge="Revisá si tenés experiencia relacionada que no está nombrada con este término exacto.",
            ))

        # experience gap
        if exp_check.status in ("partial_match", "missing_or_unknown"):
            if exp_check.reason == "unparseable_dates":
                gaps.append(CompatibilityGap(
                    area="Experiencia requerida",
                    severity=exp_check.severity,
                    explanation="No pudimos calcular tus años de experiencia porque faltan fechas en tu CV.",
                    bridge="Completá las fechas de inicio y fin de cada experiencia en tu CV.",
                ))
            else:
                gap_detail = (
                    f"Experiencia requerida: {exp_check.required_years:.0f} años"
                )
                if exp_check.total_years_detected is not None:
                    gap_detail += f" · Detectada: {exp_check.total_years_detected:.1f} años"
                if (exp_check.relevant_years_detected is not None
                        and exp_check.relevant_years_detected != exp_check.total_years_detected):
                    gap_detail += f" ({exp_check.relevant_years_detected:.1f} relevantes)"
                gaps.append(CompatibilityGap(
                    area="Experiencia requerida",
                    severity=exp_check.severity,
                    explanation=gap_detail,
                    bridge="Considerá destacar proyectos o roles donde adquiriste experiencia relevante.",
                ))

        # score heuristic factoring experience gap
        if job_required and not matched:
            ratio = 0.0
        elif not all_job:
            ratio = 0.5
        else:
            ratio = len(matched & job_required) / len(job_required) if job_required else 1.0

        exp_penalty = 0
        if exp_check.severity == "blocker":
            exp_penalty = 25
        elif exp_check.severity == "warning":
            exp_penalty = 10

        heuristic_score = max(0, min(100, int(ratio * 100) - exp_penalty))
        if heuristic_score > 70:
            compat = "alta"
        elif heuristic_score > 50:
            compat = "media"
        else:
            compat = "baja"

        summary_parts = ["Análisis heurístico (sin IA)."]
        if warnings:
            summary_parts.append(warnings[0])
        if matched:
            summary_parts.append(f"Se detectaron {len(matched)} coincidencias directas de habilidades.")
        if missing:
            summary_parts.append(f"Hay {len(missing)} términos de la vacante no encontrados textualmente en el CV — puede tratarse de sinónimos o habilidades no mencionadas.")
        if exp_check.severity == "blocker":
            summary_parts.append(f"No cumples el requisito de {exp_check.required_years:.0f} años de experiencia.")

        recommendations: list[str] = []
        if missing:
            recommendations.append(f"Verificá si tenés experiencia con: {', '.join(sorted(missing)[:3])} — puede que uses otro nombre.")
        if exp_check.reason == "unparseable_dates":
            recommendations.append("Completá las fechas de inicio y fin de cada experiencia para que podamos calcular tus años de experiencia.")
        elif exp_check.severity == "blocker":
            recommendations.append(f"La vacante pide {exp_check.required_years:.0f} años de experiencia. Revisá si tenés experiencia no registrada que puedas agregar al CV.")

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

    @staticmethod
    def adapted_cv_to_structured_cv(source_cv: StructuredCV, adapted: AdaptedCV) -> StructuredCV:
        """Build a new StructuredCV from the source CV with adapted summary and bullets.

        This is the SINGLE source of truth for this mapping — the frontend never
        duplicates it. All fields except summary and bullets are carried over
        unchanged from the source CV so the re-score includes the same profile
        dimensions (skills, education, etc.) as the original score.

        raw_text matters here: score_cv.md receives the whole serialised CV, so
        dropping it would hand the re-score ~44% less evidence than the baseline
        score saw and bias the comparison downwards for free.
        """
        experience_map: dict[tuple[str, str], CVExperience] = {
            (e.company.strip().lower(), e.title.strip().lower()): e
            for e in source_cv.experience
        }
        new_experience: list[CVExperience] = []
        for ae in adapted.adapted_experience:
            key = (ae.company.strip().lower(), ae.title.strip().lower())
            src = experience_map.get(key)
            if src:
                new_experience.append(CVExperience(
                    company=src.company,
                    title=src.title,
                    location=src.location,
                    start_date=src.start_date,
                    end_date=src.end_date,
                    duration_months=src.duration_months,
                    bullets=list(ae.rewritten_bullets) if ae.rewritten_bullets else src.bullets,
                    achievements=list(src.achievements),
                    technologies=list(src.technologies),
                ))
            else:
                new_experience.append(CVExperience(
                    company=ae.company,
                    title=ae.title,
                    bullets=list(ae.rewritten_bullets),
                ))

        return StructuredCV(
            basics=CVBasics(
                full_name=source_cv.basics.full_name,
                headline=source_cv.basics.headline,
                email=source_cv.basics.email,
                phone=source_cv.basics.phone,
                location=source_cv.basics.location,
                linkedin=source_cv.basics.linkedin,
                website=source_cv.basics.website,
            ),
            summary=adapted.adapted_summary or source_cv.summary,
            skills=[CVSkill(name=s.name, category=s.category, proficiency=s.proficiency) for s in source_cv.skills],
            experience=new_experience,
            education=list(source_cv.education),
            certifications=list(source_cv.certifications),
            languages=list(source_cv.languages),
            projects=list(source_cv.projects),
            keywords=list(source_cv.keywords),
            raw_text=source_cv.raw_text,
            meta=source_cv.meta,
        )

    def score_adapted(self, adapted: AdaptedCV, job: StructuredJob, context: ProviderContext) -> MatchScoreResult:
        """Re-score adapted CV against the same job, using the exact same pipeline as score_match."""
        source_cv = adapted.source_cv
        if not source_cv:
            # Not a heuristic result — nothing was computed. Labelling it
            # "heuristic" made the UI advertise a degraded analysis that never
            # ran, hiding a score of 0 behind a plausible-looking explanation.
            return MatchScoreResult(
                score=0, compatibility="baja",
                summary="No se pudo recalcular: falta el CV original en el resultado de adaptación.",
                strategy="failed",
            )
        reconstructed = self.adapted_cv_to_structured_cv(source_cv, adapted)
        return self.score_match(reconstructed, job, context)

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
