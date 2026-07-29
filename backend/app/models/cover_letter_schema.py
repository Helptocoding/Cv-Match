from pydantic import BaseModel, Field

from app.models.cv_schema import ProcessingMetadata
from app.models.cv_schema import StructuredCV
from app.models.job_schema import StructuredJob


class CoverLetterRequest(BaseModel):
    cv: StructuredCV
    job: StructuredJob
    tone: str = "professional"


class CoverLetterResult(BaseModel):
    cover_letter: str = ""
    meta: ProcessingMetadata = Field(default_factory=ProcessingMetadata)
