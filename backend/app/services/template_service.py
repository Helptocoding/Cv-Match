from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.export_schema import AdaptedCV


BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"

env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
)


class TemplateService:
    def render_harvard_html(self, adapted_cv: AdaptedCV) -> str:
        template = env.get_template("harvard/template.html")
        source_cv = adapted_cv.source_cv
        skills: list[str] = []
        education = []
        experience_map: dict[str, object] = {}

        if source_cv:
            skills = [skill.name for skill in source_cv.skills]
            education = source_cv.education
            experience_map = {
                f"{exp.company.strip().lower()}||{exp.title.strip().lower()}": exp
                for exp in source_cv.experience
            }

        return template.render(
            adapted_cv=adapted_cv,
            source_cv=source_cv,
            skills=skills,
            education=education,
            experience_map=experience_map,
        )
