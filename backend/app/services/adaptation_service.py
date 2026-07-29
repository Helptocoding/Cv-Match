import json
from pathlib import Path
from typing import Any

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.adaptation_schema import ApprovedLatentSkill, SkillCoverageResult
from app.models.cv_schema import ProcessingMetadata, StructuredCV
from app.models.export_schema import AdaptedCV, AdaptedExperience
from app.models.job_schema import StructuredJob
from app.services.coverage_service import CoverageService, compute_adaptation_impact
from app.services.llm_client import LLMClient
from app.utils.keyword_utils import normalize_keywords


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"


class AdaptationService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        self.llm.stage = "adapt_cv"
        self.coverage = CoverageService()

    def adapt_cv(self, cv: StructuredCV, job: StructuredJob, context: ProviderContext, mode: str = "fast") -> AdaptedCV:
        prompt = (PROMPTS_DIR / "adapt_cv.md").read_text(encoding="utf-8")

        coverage_result = None
        coverage_failed = False
        if mode == "deep":
            coverage_result = self.coverage.analyze(cv, job, context)
            # Silently continuing as if deep mode had found nothing is
            # indistinguishable, for the candidate, from "you have no
            # transferable skills" — the wizard simply never opens.
            coverage_failed = coverage_result is None

        llm_result, warnings = self._try_llm(prompt, cv, job, context, coverage=coverage_result)
        if coverage_failed:
            warnings.append(
                "El análisis de habilidades transferibles (modo profundo) no pudo completarse; "
                "se adaptó el CV sin esa etapa."
            )
        if llm_result:
            llm_result, repair_warnings = self._repair_missing_bullets_if_needed(
                prompt, llm_result, cv, job, context, coverage=coverage_result,
            )
            warnings.extend(repair_warnings)
            normalized_result = self._normalize_llm_result(llm_result, cv, job)
            adapted = AdaptedCV.model_validate({**normalized_result, "source_cv": cv})
            adapted.meta = ProcessingMetadata(
                strategy="llm",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            )
            if mode == "deep" and coverage_result:
                adapted.skill_coverage = coverage_result.coverage
                adapted.latent_proposals = coverage_result.proposals
                # Only meaningful when there is actually something to approve.
                # With zero proposals the wizard never opens, so this notice
                # would describe a gate the candidate never sees.
                if coverage_result.proposals:
                    adapted.meta.warnings.append(
                        "Modo profundo: las habilidades transferibles requieren aprobación antes de incluirse en la versión final."
                    )
            if not adapted.warnings:
                adapted.warnings = [
                    "No se inventaron experiencias, empresas, fechas ni logros.",
                    "Revisá el resultado antes de exportar para confirmar que cada elemento está respaldado por el CV original.",
                ]
            adapted.impact = compute_adaptation_impact(cv, adapted, job)
            return adapted

        return self._heuristic_fallback(cv, job, warnings, coverage_result=coverage_result)

    def finalize_adaptation(
        self,
        cv: StructuredCV,
        job: StructuredJob,
        approved_skills: list[ApprovedLatentSkill],
        context: ProviderContext,
        known_coverage: SkillCoverageResult | None = None,
    ) -> AdaptedCV:
        base_prompt = (PROMPTS_DIR / "adapt_cv.md").read_text(encoding="utf-8")
        # Reuse the coverage the candidate actually reviewed in the wizard.
        # Re-running it here would spend an extra LLM round-trip to rebuild the
        # same analysis, and any drift would mean finalizing against a
        # different classification than the one that was approved.
        coverage_result = known_coverage or self.coverage.analyze(cv, job, context)

        explicit = []
        missing = []
        if coverage_result:
            for item in coverage_result.coverage:
                if item.status == "explicit_match":
                    explicit.append(item.skill)
                elif item.status == "missing":
                    missing.append(item.skill)

        finalize_ctx = f"""
## FINALIZATION — Approved Skills Only

The candidate has reviewed transferable skill proposals and approved a subset.
Regenerate the adapted CV using ONLY the skills listed below.

### EXPLICIT MATCHES (integrate freely)
{json.dumps(explicit, ensure_ascii=False)}

### APPROVED TRANSFERABLE SKILLS (must integrate into bullets or summary)
{json.dumps([s.model_dump() for s in approved_skills], ensure_ascii=False, indent=2)}

### SKILLS TO EXCLUDE (do NOT mention anywhere in the output)
{json.dumps(missing, ensure_ascii=False)}

Rules:
- Integrate approved transferable skills using their suggested_phrase wherever truthful.
- Never invent experience, tools, or credentials not present in source_cv.
- excluded skills must NOT appear in adapted_summary, rewritten_bullets, or added_keywords.
"""
        prompt = base_prompt + finalize_ctx

        payload_dict: dict[str, Any] = {
            "source_cv": cv.model_dump(mode="json"),
            "job": job.model_dump(mode="json"),
        }
        if coverage_result and coverage_result.coverage:
            payload_dict["coverage_analysis"] = [item.model_dump() for item in coverage_result.coverage]

        payload = json.dumps(payload_dict, ensure_ascii=True)
        try:
            result = self.llm.extract_json(prompt, payload, context)
        except (ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError) as exc:
            return self._heuristic_fallback(cv, job, [f"Finalización falló: {exc}"])

        if result:
            result, repair_warnings = self._repair_missing_bullets_if_needed(
                prompt, result, cv, job, context, coverage=coverage_result,
            )
            normalized = self._normalize_llm_result(result, cv, job)
            adapted = AdaptedCV.model_validate({**normalized, "source_cv": cv})
            adapted.meta = ProcessingMetadata(
                strategy="llm",
                provider=context.provider or "",
                model=context.model or "",
                warnings=repair_warnings,
            )
            if coverage_result:
                adapted.skill_coverage = coverage_result.coverage
            if not adapted.warnings:
                adapted.warnings = [
                    "Versión final con habilidades transferibles aprobadas.",
                    "Revisá el resultado antes de exportar.",
                ]
            adapted.impact = compute_adaptation_impact(cv, adapted, job)
            return adapted

        return self._heuristic_fallback(cv, job, ["LLM no devolvió resultado en finalización."])

    def _heuristic_fallback(
        self,
        cv: StructuredCV,
        job: StructuredJob,
        warnings: list[str],
        coverage_result: SkillCoverageResult | None = None,
    ) -> AdaptedCV:
        job_keywords = normalize_keywords(job.keywords_ats + [skill.name for skill in job.required_skills])
        adapted_experience: list[AdaptedExperience] = []
        emphasized_keywords: set[str] = set()

        for experience in cv.experience:
            rewritten_bullets = []
            bullet_was_rewritten = []
            local_keywords: list[str] = []
            for bullet in experience.bullets[:5]:
                matches = [keyword for keyword in job_keywords if keyword in bullet.lower()]
                if matches:
                    local_keywords.extend(matches)
                    emphasized_keywords.update(matches)
                    rewritten_bullets.append(f"{bullet} ({', '.join(sorted(set(matches)))})")
                    bullet_was_rewritten.append(True)
                else:
                    rewritten_bullets.append(bullet)
                    bullet_was_rewritten.append(False)
            adapted_experience.append(
                AdaptedExperience(
                    company=experience.company,
                    title=experience.title,
                    rewritten_bullets=rewritten_bullets or experience.bullets,
                    bullet_was_rewritten=bullet_was_rewritten or [False] * len(experience.bullets),
                    keywords_emphasized=sorted(set(local_keywords)),
                )
            )

        summary = cv.summary or ""
        if emphasized_keywords:
            summary = f"{summary} Orientado a roles que requieren {', '.join(sorted(emphasized_keywords)[:5])}.".strip()

        cv_skill_names = {skill.name.lower() for skill in cv.skills}
        missing_skills = [
            skill.name
            for skill in job.required_skills
            if skill.name.lower() not in cv_skill_names and skill.priority == "must_have"
        ]

        result = AdaptedCV(
            adapted_summary=summary,
            adapted_experience=adapted_experience,
            added_keywords=sorted(emphasized_keywords),
            missing_skills=missing_skills,
            latent_skills=[],
            warnings=[
                "No se inventaron experiencias, empresas, fechas ni logros.",
                "Revisá el resultado antes de exportar para confirmar que cada elemento está respaldado por el CV original.",
            ],
            source_cv=cv,
            meta=ProcessingMetadata(
                strategy="heuristic",
                provider="",
                model="",
                warnings=warnings,
            ),
        )
        if coverage_result:
            result.skill_coverage = coverage_result.coverage
            result.latent_proposals = coverage_result.proposals
        result.impact = compute_adaptation_impact(cv, result, job)
        return result

    def _normalize_llm_result(self, result: dict, cv: StructuredCV, job: StructuredJob) -> dict:
        normalized = dict(result)
        normalized_experience: list[dict] = []
        allowed_keywords = set(normalize_keywords(job.keywords_ats + [skill.name for skill in job.required_skills]))

        llm_experience_by_key = {
            self._experience_key(str(item.get("company", "")), str(item.get("title", ""))): item
            for item in normalized.get("adapted_experience", [])
            if isinstance(item, dict) and self._experience_key(str(item.get("company", "")), str(item.get("title", "")))
        }

        if cv.experience:
            for source_item in cv.experience:
                llm_item = llm_experience_by_key.get(self._experience_key(source_item.company, source_item.title), {})
                bullets = [
                    str(bullet).strip() for bullet in llm_item.get("rewritten_bullets", []) if str(bullet).strip()
                ]
                if bullets:
                    bullet_was_rewritten = [True] * len(bullets)
                else:
                    bullets = source_item.bullets
                    bullet_was_rewritten = [False] * len(source_item.bullets)
                keywords = [
                    keyword for keyword in normalize_keywords([str(value) for value in llm_item.get("keywords_emphasized", [])])
                    if keyword in allowed_keywords
                ]
                normalized_experience.append(
                    {
                        "company": source_item.company,
                        "title": source_item.title,
                        "rewritten_bullets": bullets,
                        "bullet_was_rewritten": bullet_was_rewritten,
                        "keywords_emphasized": keywords,
                    }
                )

        if not normalized_experience:
            normalized_experience = [
                {
                    "company": item.company,
                    "title": item.title,
                    "rewritten_bullets": item.bullets,
                    "bullet_was_rewritten": [False] * len(item.bullets),
                    "keywords_emphasized": [],
                }
                for item in cv.experience
            ]

        normalized_keywords = [
            keyword for keyword in normalize_keywords([str(value) for value in normalized.get("added_keywords", [])])
            if keyword in allowed_keywords
        ]
        normalized_warnings = [str(item).strip() for item in normalized.get("warnings", []) if str(item).strip()]
        normalized_missing = [str(s).strip() for s in normalized.get("missing_skills", []) if str(s).strip()]

        raw_latent = normalized.get("latent_skills", [])
        normalized_latent: list[dict] = []
        for item in raw_latent:
            if isinstance(item, dict):
                skill = str(item.get("skill", "")).strip()
                evidence = str(item.get("evidence", "")).strip()
                if skill:
                    normalized_latent.append({"skill": skill, "evidence": evidence})

        return {
            "adapted_summary": str(normalized.get("adapted_summary", cv.summary or "")).strip(),
            "adapted_experience": normalized_experience,
            "added_keywords": normalized_keywords,
            "missing_skills": normalized_missing,
            "latent_skills": normalized_latent,
            "warnings": normalized_warnings,
        }

    def _experience_key(self, company: str, title: str) -> tuple[str, str]:
        return (company.strip().lower(), title.strip().lower())

    def _missing_bullet_entries(self, result: dict, cv: StructuredCV) -> list[dict[str, str]]:
        llm_experience_by_key = {
            self._experience_key(str(item.get("company", "")), str(item.get("title", ""))): item
            for item in result.get("adapted_experience", [])
            if isinstance(item, dict)
        }
        missing: list[dict[str, str]] = []
        for item in cv.experience:
            llm_item = llm_experience_by_key.get(self._experience_key(item.company, item.title))
            bullets = []
            if isinstance(llm_item, dict):
                bullets = [str(bullet).strip() for bullet in llm_item.get("rewritten_bullets", []) if str(bullet).strip()]
            if not bullets:
                missing.append({"company": item.company, "title": item.title})
        return missing

    def _repair_missing_bullets_if_needed(
        self,
        prompt: str,
        result: dict,
        cv: StructuredCV,
        job: StructuredJob,
        context: ProviderContext,
        coverage: SkillCoverageResult | None = None,
    ) -> tuple[dict, list[str]]:
        missing = self._missing_bullet_entries(result, cv)
        if not missing:
            return result, []

        repair_prompt = prompt + """

REPAIR PASS:
- Your previous JSON omitted rewritten_bullets for one or more experience entries.
- Return the FULL JSON object again, not a partial patch.
- Include one adapted_experience item for every source_cv.experience item.
- Every adapted_experience item must include rewritten_bullets.
- If a bullet should stay almost unchanged, still return it explicitly.
"""
        payload_dict: dict[str, Any] = {
            "source_cv": cv.model_dump(mode="json"),
            "job": job.model_dump(mode="json"),
            "previous_output": result,
            "missing_experience_entries": missing,
        }
        if coverage and coverage.coverage:
            payload_dict["coverage_analysis"] = [item.model_dump() for item in coverage.coverage if item.status != "latent_match"]

        previous_stage = self.llm.stage
        self.llm.stage = "adapt_repair"
        try:
            repaired = self.llm.extract_json(
                repair_prompt,
                json.dumps(payload_dict, ensure_ascii=True),
                context,
            )
        except (ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError):
            return result, [
                "Algunos bullets no fueron reescritos por el modelo; se conservaron con una marca visual de 'igual'.",
            ]
        finally:
            self.llm.stage = previous_stage

        if not repaired or self._missing_bullet_entries(repaired, cv):
            return repaired or result, [
                "Algunos bullets no fueron reescritos por el modelo; se conservaron con una marca visual de 'igual'.",
            ]

        return repaired, []

    def _try_llm(
        self,
        prompt: str,
        cv: StructuredCV,
        job: StructuredJob,
        context: ProviderContext,
        coverage: SkillCoverageResult | None = None,
    ) -> tuple[dict | None, list[str]]:
        payload_dict: dict[str, Any] = {
            "source_cv": cv.model_dump(mode="json"),
            "job": job.model_dump(mode="json"),
        }
        if coverage and coverage.coverage:
            # Latent proposals require explicit candidate approval via the
            # wizard before they may appear in generated text. Excluding
            # them here (not just filtering the output afterwards) stops
            # unapproved phrasing from ever reaching the model's context.
            pre_approved = [
                item.model_dump() for item in coverage.coverage if item.status != "latent_match"
            ]
            if pre_approved:
                payload_dict["coverage_analysis"] = pre_approved

        payload = json.dumps(payload_dict, ensure_ascii=True)
        try:
            return self.llm.extract_json(prompt, payload, context), []
        except ProviderConfigurationError as exc:
            return None, [str(exc)]
        except (ProviderRequestError, ProviderResponseFormatError) as exc:
            return None, [f"Se activó fallback heurístico: {exc}"]
