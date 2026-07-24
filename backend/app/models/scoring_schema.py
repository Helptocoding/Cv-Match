from pydantic import BaseModel, Field

from app.models.cv_schema import StructuredCV
from app.models.job_schema import StructuredJob


class ScoreWeights(BaseModel):
    skills: float = 0.35
    experience: float = 0.30
    education: float = 0.15
    keywords_ats: float = 0.20


class CompatibilityStrength(BaseModel):
    area: str = ""
    explanation: str = ""


class CompatibilityGap(BaseModel):
    area: str = ""
    severity: str = "superable"
    explanation: str = ""
    bridge: str = ""


class TransferableSkill(BaseModel):
    skill: str = ""
    context: str = ""


class MatchScoreResult(BaseModel):
    score: int = 50
    compatibility: str = "media"
    summary: str = ""
    strengths: list[CompatibilityStrength] = Field(default_factory=list)
    gaps: list[CompatibilityGap] = Field(default_factory=list)
    transferable_skills: list[TransferableSkill] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    strategy: str = "heuristic"


class MatchScoreRequest(BaseModel):
    cv_structured: StructuredCV
    job_structured: StructuredJob
    weights: ScoreWeights = Field(default_factory=ScoreWeights)
