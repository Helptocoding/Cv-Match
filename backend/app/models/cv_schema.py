from pydantic import BaseModel, Field


class ProcessingMetadata(BaseModel):
    strategy: str = "heuristic"
    provider: str = ""
    model: str = ""
    warnings: list[str] = Field(default_factory=list)


class CVBasics(BaseModel):
    full_name: str = ""
    headline: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    website: str = ""


class CVSkill(BaseModel):
    name: str
    category: str = "general"
    proficiency: str = "unknown"


class CVExperience(BaseModel):
    company: str = ""
    title: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    duration_months: int = 0
    bullets: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class CVEducation(BaseModel):
    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""
    details: list[str] = Field(default_factory=list)


class CVCertification(BaseModel):
    name: str
    issuer: str = ""
    date: str = ""


class CVLanguage(BaseModel):
    name: str
    level: str = ""


class CVProject(BaseModel):
    name: str
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    url: str = ""


class StructuredCV(BaseModel):
    basics: CVBasics = Field(default_factory=CVBasics)
    summary: str = ""
    skills: list[CVSkill] = Field(default_factory=list)
    experience: list[CVExperience] = Field(default_factory=list)
    education: list[CVEducation] = Field(default_factory=list)
    certifications: list[CVCertification] = Field(default_factory=list)
    languages: list[CVLanguage] = Field(default_factory=list)
    projects: list[CVProject] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    raw_text: str = ""
    meta: ProcessingMetadata = Field(default_factory=ProcessingMetadata)
