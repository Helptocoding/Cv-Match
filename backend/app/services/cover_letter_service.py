import json
from pathlib import Path

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.cover_letter_schema import CoverLetterResult
from app.models.cv_schema import ProcessingMetadata, StructuredCV
from app.models.job_schema import StructuredJob
from app.services.llm_client import LLMClient


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"


class CoverLetterService:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate(
        self,
        cv: StructuredCV,
        job: StructuredJob,
        context: ProviderContext,
        tone: str = "professional",
    ) -> CoverLetterResult:
        prompt = (PROMPTS_DIR / "generate_cover_letter.md").read_text(encoding="utf-8")
        llm_result, warnings = self._try_llm(prompt, cv, job, context, tone)
        if llm_result:
            letter_text = llm_result.get("cover_letter", "").strip()
            if letter_text:
                return CoverLetterResult(
                    cover_letter=letter_text,
                    meta=ProcessingMetadata(
                        strategy="llm",
                        provider=context.provider or "",
                        model=context.model or "",
                        warnings=warnings,
                    ),
                )

        return self._heuristic_fallback(cv, job, warnings, context)

    def _heuristic_fallback(
        self,
        cv: StructuredCV,
        job: StructuredJob,
        warnings: list[str],
        context: ProviderContext,
    ) -> CoverLetterResult:
        candidate_name = cv.basics.full_name or "Candidato"
        company = job.company_name or "la empresa"
        job_title = job.job_title or "el puesto"

        cv_skill_names = {s.name.lower() for s in cv.skills}
        relevant_skills = [
            s.name for s in job.required_skills if s.name.lower() in cv_skill_names
        ][:5]

        lines: list[str] = []
        lines.append(f"Estimado equipo de {company},")
        lines.append("")
        lines.append(
            f"Me dirijo a ustedes para expresar mi interés en la posición de {job_title} "
            f"en {company}. Con mi experiencia y habilidades, considero que puedo "
            f"aportar valor significativo a su equipo."
        )
        lines.append("")

        if relevant_skills:
            skills_text = ", ".join(relevant_skills)
            lines.append(
                f"Mi perfil cuenta con experiencia comprobable en {skills_text}, "
                f"competencias que considero directamente relevantes para los desafíos de este rol."
            )
            lines.append("")

        if cv.summary:
            lines.append(f"{cv.summary}")
            lines.append("")

        lines.append(
            f"Me entusiasma la posibilidad de contribuir al éxito de {company} "
            f"y espero tener la oportunidad de conversar sobre cómo mi trayectoria "
            f"puede alinearse con los objetivos de su equipo."
        )
        lines.append("")
        lines.append("Atentamente,")
        lines.append(candidate_name)

        return CoverLetterResult(
            cover_letter="\n".join(lines),
            meta=ProcessingMetadata(
                strategy="heuristic",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            ),
        )

    def _try_llm(
        self,
        prompt: str,
        cv: StructuredCV,
        job: StructuredJob,
        context: ProviderContext,
        tone: str,
    ) -> tuple[dict | None, list[str]]:
        payload = json.dumps(
            {
                "source_cv": cv.model_dump(mode="json"),
                "job": job.model_dump(mode="json"),
                "tone": tone,
            },
            ensure_ascii=True,
        )
        try:
            return self.llm.extract_json(prompt, payload, context), []
        except ProviderConfigurationError as exc:
            return None, [str(exc)]
        except (ProviderRequestError, ProviderResponseFormatError) as exc:
            return None, [f"Se activó fallback heurístico: {exc}"]
