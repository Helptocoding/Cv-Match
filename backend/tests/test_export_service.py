from app.models.cv_schema import CVBasics, CVExperience, CVSkill, StructuredCV
from app.models.export_schema import AdaptedCV, AdaptedExperience
from app.services.export_service import ExportService


def test_build_harvard_pdf_returns_bytes() -> None:
    service = ExportService()
    source_cv = StructuredCV(
        basics=CVBasics(full_name="Jane Doe", headline="Backend Engineer"),
        skills=[CVSkill(name="Python")],
        experience=[CVExperience(company="Acme", title="Engineer", bullets=["Built APIs."])],
    )
    adapted = AdaptedCV(
        adapted_summary="Backend engineer focused on API delivery.",
        adapted_experience=[AdaptedExperience(company="Acme", title="Engineer", rewritten_bullets=["Built APIs."])],
        source_cv=source_cv,
    )

    pdf_bytes = service.build_harvard_pdf(adapted)

    assert pdf_bytes.startswith(b"%PDF")


def test_build_harvard_docx_returns_docx_signature() -> None:
    service = ExportService()
    source_cv = StructuredCV(
        basics=CVBasics(full_name="Jane Doe", headline="Backend Engineer"),
        skills=[CVSkill(name="Python")],
        experience=[CVExperience(company="Acme", title="Engineer", bullets=["Built APIs."])],
    )
    adapted = AdaptedCV(
        adapted_summary="Backend engineer focused on API delivery.",
        adapted_experience=[AdaptedExperience(company="Acme", title="Engineer", rewritten_bullets=["Built APIs."])],
        source_cv=source_cv,
    )

    docx_bytes = service.build_harvard_docx(adapted)

    assert docx_bytes.startswith(b"PK")


def test_build_markdown_returns_expected_sections() -> None:
    service = ExportService()
    source_cv = StructuredCV(
        basics=CVBasics(full_name="Jane Doe", headline="Backend Engineer"),
        skills=[CVSkill(name="Python")],
        experience=[CVExperience(company="Acme", title="Engineer", bullets=["Built APIs."])],
    )
    adapted = AdaptedCV(
        adapted_summary="Backend engineer focused on API delivery.",
        adapted_experience=[AdaptedExperience(company="Acme", title="Engineer", rewritten_bullets=["Built APIs."])],
        source_cv=source_cv,
        added_keywords=["python"],
    )

    markdown = service.build_markdown(adapted)

    assert "# Jane Doe" in markdown
    assert "## Experience" in markdown
    assert "## Targeted Keywords" in markdown
