from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import adapt, export, health, parse, scoring
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title="CV Matcher API",
    version="0.1.0",
    description="Stateless BYOK backend for parsing CVs, matching jobs, adapting resumes, and exporting PDFs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(parse.router, prefix="/api/v1", tags=["parse"])
app.include_router(scoring.router, prefix="/api/v1", tags=["score"])
app.include_router(adapt.router, prefix="/api/v1", tags=["adapt"])
app.include_router(export.router, prefix="/api/v1", tags=["export"])
