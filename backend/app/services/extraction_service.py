import re
from pathlib import Path

from app.api.deps import ProviderContext
from app.core.exceptions import ProviderConfigurationError, ProviderRequestError, ProviderResponseFormatError
from app.models.cv_schema import CVBasics, CVExperience, CVSkill, ProcessingMetadata, StructuredCV
from app.models.job_schema import JobSkill, RequiredExperience, StructuredJob
from app.services.llm_client import LLMClient


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"
SKILL_PATTERN = re.compile(r"\b(python|java|javascript|typescript|react|next\.js|nextjs|fastapi|django|docker|kubernetes|postgresql|sql|aws|git|rest|graphql)\b", re.IGNORECASE)


class ExtractionService:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def parse_cv(self, raw_text: str, context: ProviderContext) -> StructuredCV:
        prompt = (PROMPTS_DIR / "extract_cv.md").read_text(encoding="utf-8")
        parsed, warnings = self._try_llm(prompt, raw_text, context)
        if parsed:
            cv = StructuredCV.model_validate(parsed)
            cv.meta = ProcessingMetadata(
                strategy="llm",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            )
            return cv

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        name = lines[0] if lines else "Candidate"
        summary = lines[1] if len(lines) > 1 else ""
        skills = [CVSkill(name=skill.title() if skill.lower() != "next.js" else "Next.js") for skill in self._extract_skills(raw_text)]
        experience = [
            CVExperience(
                company="Recent Experience",
                title="Candidate",
                bullets=lines[2:8],
                achievements=lines[2:5],
                technologies=[skill.name for skill in skills[:6]],
            )
        ] if len(lines) > 2 else []
        keywords = [skill.name for skill in skills]
        return StructuredCV(
            basics=CVBasics(full_name=name),
            summary=summary,
            skills=skills,
            experience=experience,
            keywords=keywords,
            raw_text=raw_text,
            meta=ProcessingMetadata(
                strategy="heuristic",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            ),
        )

    def parse_job(self, raw_text: str, context: ProviderContext) -> StructuredJob:
        prompt = (PROMPTS_DIR / "extract_job.md").read_text(encoding="utf-8")
        parsed, warnings = self._try_llm(prompt, raw_text, context)
        if parsed:
            job = StructuredJob.model_validate(parsed)
            job.meta = ProcessingMetadata(
                strategy="llm",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            )
            return job

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        skills = [JobSkill(name=skill.title() if skill.lower() != "next.js" else "Next.js") for skill in self._extract_skills(raw_text)]
        keywords = [skill.name for skill in skills]
        seniority = self._detect_seniority(raw_text)
        years = self._detect_years(raw_text)
        return StructuredJob(
            job_title=lines[0] if lines else "Target Role",
            summary=lines[1] if len(lines) > 1 else "",
            required_skills=skills[:8],
            preferred_skills=skills[8:12],
            required_experience=RequiredExperience(min_years=years, roles=[lines[0]] if lines else []),
            seniority=seniority,
            responsibilities=lines[2:8],
            keywords_ats=keywords,
            tools_and_technologies=keywords,
            raw_text=raw_text,
            meta=ProcessingMetadata(
                strategy="heuristic",
                provider=context.provider or "",
                model=context.model or "",
                warnings=warnings,
            ),
        )

    def _try_llm(self, prompt: str, raw_text: str, context: ProviderContext) -> tuple[dict | None, list[str]]:
        try:
            return self.llm.extract_json(prompt, raw_text, context), []
        except ProviderConfigurationError as exc:
            return None, [str(exc)]
        except (ProviderRequestError, ProviderResponseFormatError) as exc:
            return None, [f"Se activo fallback heuristico: {exc}"]

    def _extract_skills(self, raw_text: str) -> list[str]:
        seen: set[str] = set()
        skills: list[str] = []
        for match in SKILL_PATTERN.findall(raw_text):
            normalized = match.lower().replace("nextjs", "next.js")
            if normalized not in seen:
                seen.add(normalized)
                skills.append(normalized)
        return skills

    def _detect_seniority(self, raw_text: str) -> str:
        lowered = raw_text.lower()
        if "senior" in lowered:
            return "senior"
        if "junior" in lowered:
            return "junior"
        return "mid"

    def _detect_years(self, raw_text: str) -> int:
        match = re.search(r"(\d+)\+?\s+years", raw_text.lower())
        return int(match.group(1)) if match else 0
