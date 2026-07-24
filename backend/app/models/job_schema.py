from pydantic import BaseModel, Field

from app.models.cv_schema import ProcessingMetadata


class JobSkill(BaseModel):
    name: str
    priority: str = "must_have"
    years_required: int = 0


class RequiredExperience(BaseModel):
    min_years: int = 0
    domains: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)


class EducationRequirement(BaseModel):
    degree_level: str = ""
    field: str = ""
    required: bool = False


class StructuredJob(BaseModel):
    job_title: str = ""
    company_name: str = ""
    location: str = ""
    employment_type: str = ""
    seniority: str = ""
    summary: str = ""
    required_skills: list[JobSkill] = Field(default_factory=list)
    preferred_skills: list[JobSkill] = Field(default_factory=list)
    required_experience: RequiredExperience = Field(default_factory=RequiredExperience)
    education_requirements: list[EducationRequirement] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    keywords_ats: list[str] = Field(default_factory=list)
    tools_and_technologies: list[str] = Field(default_factory=list)
    raw_text: str = ""
    meta: ProcessingMetadata = Field(default_factory=ProcessingMetadata)
