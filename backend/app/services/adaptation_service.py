import json
from pathlib import Path

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.cv_schema import ProcessingMetadata, StructuredCV
from app.models.export_schema import AdaptedCV, AdaptedExperience
from app.models.job_schema import StructuredJob
from app.services.llm_client import LLMClient
from app.utils.keyword_utils import normalize_keywords


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"


class AdaptationService:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def adapt_cv(self, cv: StructuredCV, job: StructuredJob, context: ProviderContext) -> AdaptedCV:
        prompt = (PROMPTS_DIR / "adapt_cv.md").read_text(encoding="utf-8")
        llm_result, warnings = self._try_llm(prompt, cv, job, context)
        if llm_result:
            normalized_result = self._normalize_llm_result(llm_result, cv, job)
            adapted = AdaptedCV.model_validate({**normalized_result, "source_cv": cv})
            adapted.meta = ProcessingMetadata(
                strategy="llm",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            )
            if not adapted.warnings:
                adapted.warnings = [
                    "No se inventaron experiencias, empresas, fechas ni logros.",
                    "Revisá el resultado antes de exportar para confirmar que cada elemento está respaldado por el CV original.",
                ]
            return adapted

        job_keywords = normalize_keywords(job.keywords_ats + [skill.name for skill in job.required_skills])
        adapted_experience: list[AdaptedExperience] = []
        emphasized_keywords: set[str] = set()

        for experience in cv.experience:
            rewritten_bullets = []
            local_keywords: list[str] = []
            for bullet in experience.bullets[:5]:
                matches = [keyword for keyword in job_keywords if keyword in bullet.lower()]
                if matches:
                    local_keywords.extend(matches)
                    emphasized_keywords.update(matches)
                    rewritten_bullets.append(f"{bullet} ({', '.join(sorted(set(matches)))})")
                else:
                    rewritten_bullets.append(bullet)

            adapted_experience.append(
                AdaptedExperience(
                    company=experience.company,
                    title=experience.title,
                    rewritten_bullets=rewritten_bullets or experience.bullets,
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

        return AdaptedCV(
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
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            ),
        )

    def _normalize_llm_result(self, result: dict, cv: StructuredCV, job: StructuredJob) -> dict:
        normalized = dict(result)
        normalized_experience: list[dict] = []
        allowed_keywords = set(normalize_keywords(job.keywords_ats + [skill.name for skill in job.required_skills]))

        fallback_experience_by_key = {
            (item.company.strip().lower(), item.title.strip().lower()): item for item in cv.experience
        }

        for item in normalized.get("adapted_experience", []):
            company = str(item.get("company", ""))
            title = str(item.get("title", ""))
            fallback = fallback_experience_by_key.get((company.strip().lower(), title.strip().lower()))
            bullets = [str(bullet).strip() for bullet in item.get("rewritten_bullets", []) if str(bullet).strip()]
            if not bullets and fallback:
                bullets = fallback.bullets
            keywords = [
                keyword for keyword in normalize_keywords([str(value) for value in item.get("keywords_emphasized", [])])
                if keyword in allowed_keywords
            ]
            normalized_experience.append(
                {
                    "company": company,
                    "title": title,
                    "rewritten_bullets": bullets,
                    "keywords_emphasized": keywords,
                }
            )

        if not normalized_experience:
            normalized_experience = [
                {
                    "company": item.company,
                    "title": item.title,
                    "rewritten_bullets": item.bullets,
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
