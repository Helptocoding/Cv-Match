from pydantic import BaseModel, Field


class SkillCoverageItem(BaseModel):
    skill: str
    status: str  # "explicit_match" | "latent_match" | "missing"
    evidence: str = ""
    suggested_phrase: str = ""


class LatentProposal(BaseModel):
    skill: str
    evidence: str
    suggested_phrase: str
    experience_context: str = ""


class ApprovedLatentSkill(BaseModel):
    skill: str
    suggested_phrase: str
    evidence: str


class SkillCoverageResult(BaseModel):
    coverage: list[SkillCoverageItem] = Field(default_factory=list)
    proposals: list[LatentProposal] = Field(default_factory=list)


class AdaptationImpact(BaseModel):
    """Deterministic before/after of the adaptation — no LLM involved.

    This is the primary "did adapting help?" signal. Unlike differencing two
    LLM scores it is reproducible: same CV + same vacancy always yields the
    same numbers.
    """

    skills_newly_covered: list[str] = Field(default_factory=list)
    skills_already_covered: list[str] = Field(default_factory=list)
    skills_still_missing: list[str] = Field(default_factory=list)
    bullets_total: int = 0
    bullets_rewritten: int = 0


class ExperienceRequirementCheck(BaseModel):
    required_years: float | None = None
    is_qualitative_only: bool = False
    total_years_detected: float | None = None
    relevant_years_detected: float | None = None
    dates_parsed: int = 0
    dates_total: int = 0
    status: str = "not_applicable"
    reason: str = "no_numeric_requirement"
    severity: str = "info"
