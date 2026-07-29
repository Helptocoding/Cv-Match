from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import adapt, cover_letter, export, health, parse, provider, scoring
from app.core.config import get_settings
from app.core.exceptions import ProviderAuthError


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

@app.exception_handler(ProviderAuthError)
async def provider_auth_error_handler(_request: Request, exc: ProviderAuthError) -> JSONResponse:
    """Surface rejected credentials as 401 instead of a silent heuristic result."""
    return JSONResponse(status_code=401, content={"detail": str(exc)})


_fonts_path = Path(__file__).resolve().parent / "templates" / "harvard" / "fonts"
app.mount("/static/fonts", StaticFiles(directory=str(_fonts_path)), name="fonts")

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(provider.router, prefix="/api/v1", tags=["provider"])
app.include_router(parse.router, prefix="/api/v1", tags=["parse"])
app.include_router(scoring.router, prefix="/api/v1", tags=["score"])
app.include_router(adapt.router, prefix="/api/v1", tags=["adapt"])
app.include_router(cover_letter.router, prefix="/api/v1", tags=["cover-letter"])
app.include_router(export.router, prefix="/api/v1", tags=["export"])
