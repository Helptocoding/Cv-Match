from pydantic import BaseModel, Field

from app.models.cv_schema import ProcessingMetadata
from app.models.cv_schema import StructuredCV


class AdaptedExperience(BaseModel):
    company: str = ""
    title: str = ""
    rewritten_bullets: list[str] = Field(default_factory=list)
    keywords_emphasized: list[str] = Field(default_factory=list)


class LatentSkill(BaseModel):
    skill: str = ""
    evidence: str = ""


class AdaptedCV(BaseModel):
    adapted_summary: str = ""
    adapted_experience: list[AdaptedExperience] = Field(default_factory=list)
    added_keywords: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    latent_skills: list[LatentSkill] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    source_cv: StructuredCV | None = None
    meta: ProcessingMetadata = Field(default_factory=ProcessingMetadata)


class ExportPdfRequest(BaseModel):
    adapted_cv: AdaptedCV
    template: str = "harvard"
    file_name: str = "cv-matcher-harvard.pdf"


class ExportDocxRequest(BaseModel):
    adapted_cv: AdaptedCV
    file_name: str = "cv-matcher-harvard.docx"


class ExportMarkdownRequest(BaseModel):
    adapted_cv: AdaptedCV
    file_name: str = "cv-matcher-harvard.md"
