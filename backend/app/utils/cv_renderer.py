import logging
from io import BytesIO
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

from app.models.export_schema import AdaptedCV
from app.utils.fonts import DEFAULT_FONT, resolve_font


logger = logging.getLogger("cv_renderer")

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
TEMPLATE_NAME = "harvard/template.html"
FONTS_DIR = TEMPLATES_DIR / "harvard" / "fonts"

_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))


def adapted_cv_to_template_data(adapted_cv: AdaptedCV, font_key: str = DEFAULT_FONT) -> dict:
    source = adapted_cv.source_cv

    font_option = resolve_font(font_key)
    data: dict[str, Any] = {
        "font_key": font_option.key,
        "full_name": source.basics.full_name if source else "",
        "location": source.basics.location if source else "",
        "phone": source.basics.phone if source else "",
        "email": source.basics.email if source else "",
        "linkedin": source.basics.linkedin if source else "",
        "summary": adapted_cv.adapted_summary,
    }

    education = []
    if source:
        for edu in source.education:
            dates = " – ".join(filter(None, [edu.start_date, edu.end_date]))
            education.append({
                "institution": edu.institution,
                "degree": edu.degree,
                "dates": dates,
                "details": edu.details,
            })
    data["education"] = education

    source_exp_map = {}
    if source:
        source_exp_map = {
            f"{exp.company.strip().lower()}||{exp.title.strip().lower()}": exp
            for exp in source.experience
        }

    experience = []
    for item in adapted_cv.adapted_experience:
        key = f"{item.company.strip().lower()}||{item.title.strip().lower()}"
        src = source_exp_map.get(key)
        dates = ""
        location = ""
        if src:
            dates = " – ".join(filter(None, [src.start_date, src.end_date]))
            location = src.location
        experience.append({
            "company": item.company,
            "title": item.title,
            "dates": dates,
            "location": location,
            "bullets": item.rewritten_bullets,
        })
    data["experience"] = experience

    projects = []
    if source:
        for proj in source.projects:
            projects.append({
                "name": proj.name,
                "dates": "",
                "bullets": [proj.description] if proj.description else [],
            })
    data["projects"] = projects

    skills: dict[str, list[str]] = {}
    if source:
        for skill in source.skills:
            cat = skill.category or "general"
            if cat not in skills:
                skills[cat] = []
            skills[cat].append(skill.name)
    data["skills"] = skills

    additional: dict[str, list[str]] = {}
    if source:
        if source.certifications:
            additional["Certificaciones"] = [
                f"{c.name}" + (f" – {c.issuer}" if c.issuer else "")
                for c in source.certifications
            ]
        if source.languages:
            additional["Idiomas"] = [
                f"{lang.name}" + (f" ({lang.level})" if lang.level else "")
                for lang in source.languages
            ]
    data["additional"] = additional

    return data


def render_html(data: dict, font_base_url: str | None = None) -> str:
    ctx = dict(data)
    if font_base_url is not None:
        ctx["font_base_url"] = font_base_url
    template = _env.get_template(TEMPLATE_NAME)
    return template.render(**ctx)


def html_to_pdf_weasyprint(html_content: str, base_url: str | None = None) -> bytes | None:
    try:
        from weasyprint import HTML
        kwargs = {"base_url": base_url} if base_url else {}
        return HTML(string=html_content, **kwargs).write_pdf()
    except ImportError:
        logger.warning("WeasyPrint no está instalado. pip install weasyprint")
        return None
    except Exception as exc:
        logger.warning("WeasyPrint falló al renderizar: %s", exc)
        return None


def html_to_pdf_xhtml2pdf(html_content: str) -> bytes | None:
    try:
        from xhtml2pdf import pisa
        buffer = BytesIO()
        result: Any = pisa.CreatePDF(src=html_content, dest=buffer, encoding="utf-8")
        if getattr(result, "err", 1):
            logger.warning("xhtml2pdf reportó errores durante el render")
            return None
        return buffer.getvalue()
    except ImportError:
        logger.error("xhtml2pdf no está instalado.")
        return None
    except Exception as exc:
        logger.warning("xhtml2pdf falló al renderizar: %s", exc)
        return None


def render_cv_to_pdf(adapted_cv: AdaptedCV, font_key: str = DEFAULT_FONT) -> bytes:
    data = adapted_cv_to_template_data(adapted_cv, font_key=font_key)
    font_base_url = FONTS_DIR.as_uri()
    html = render_html(data, font_base_url=font_base_url)

    pdf = html_to_pdf_weasyprint(html, base_url=font_base_url)
    if pdf is not None:
        logger.info("PDF generado con WeasyPrint")
        return pdf

    logger.info("Reintentando con xhtml2pdf...")
    pdf = html_to_pdf_xhtml2pdf(html)
    if pdf is not None:
        logger.info("PDF generado con xhtml2pdf (fallback)")
        return pdf

    raise RuntimeError(
        "No se pudo generar el PDF con ningún motor disponible. "
        "Instalá weasyprint (recomendado) o xhtml2pdf."
    )


def render_cv_to_html(adapted_cv: AdaptedCV, font_key: str = DEFAULT_FONT, font_base_url: str = "/static/fonts") -> str:
    data = adapted_cv_to_template_data(adapted_cv, font_key=font_key)
    return render_html(data, font_base_url=font_base_url)
