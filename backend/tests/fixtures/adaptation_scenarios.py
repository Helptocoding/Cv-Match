"""Mini evaluation dataset for adaptation quality.

Each scenario contains:
- cv_structured / cv_raw
- job_structured / job_raw
- expected_explicit: skills that should be explicit_match
- expected_latent: skills that could be latent_match with good evidence
- expected_missing: skills that must be missing
- unsafe_phrases_to_avoid: patterns that would be over-selling

Usage:
    Run the current adaptation pipeline against these scenarios,
    then check how many expected items appear in each category.
"""

from app.models.cv_schema import CVBasics, CVExperience, CVSkill, StructuredCV
from app.models.job_schema import JobSkill, RequiredExperience, StructuredJob


SCENARIO_1 = {
    "name": "Frontend dev → QA Engineer",
    "cv": StructuredCV(
        basics=CVBasics(full_name="Ana Garcia"),
        summary="Frontend developer with 4 years building React applications. Experienced in unit testing, UI debugging, and cross-browser compatibility.",
        skills=[
            CVSkill(name="React"),
            CVSkill(name="TypeScript"),
            CVSkill(name="Jest"),
            CVSkill(name="CSS"),
        ],
        experience=[
            CVExperience(
                company="TechCorp",
                title="Frontend Developer",
                bullets=[
                    "Developed React components with unit tests using Jest and React Testing Library.",
                    "Debugged UI rendering issues across Chrome, Firefox, and Safari.",
                    "Worked with designers to validate visual consistency and responsive layouts.",
                    "Fixed edge-case rendering bugs reported by QA team.",
                ],
                technologies=["React", "TypeScript", "Jest", "CSS"],
                achievements=["Reduced UI bugs by 30% through improved test coverage."],
            )
        ],
    ),
    "job": StructuredJob(
        job_title="QA Engineer",
        required_skills=[
            JobSkill(name="test automation", priority="must_have"),
            JobSkill(name="manual testing", priority="must_have"),
            JobSkill(name="regression testing", priority="must_have"),
            JobSkill(name="Selenium", priority="preferred"),
        ],
        preferred_skills=[JobSkill(name="CI/CD")],
        keywords_ats=["QA", "testing", "cross-browser", "regression", "quality assurance"],
        tools_and_technologies=["Selenium", "Cypress", "Jenkins"],
        required_experience=RequiredExperience(min_years=2),
        responsibilities=["Write test cases", "Execute manual and automated tests", "Report bugs"],
    ),
    "expected_explicit": ["manual testing", "regression testing"],
    "expected_latent": ["cross-browser testing", "test automation"],
    "expected_missing": ["Selenium", "CI/CD"],
    "unsafe_phrases_to_avoid": [
        "managed QA team",
        "designed test automation framework",
        "Selenium WebDriver",
    ],
}

SCENARIO_2 = {
    "name": "Backend dev → DevOps Engineer",
    "cv": StructuredCV(
        basics=CVBasics(full_name="Carlos Lopez"),
        summary="Backend engineer with Docker and cloud deployment experience.",
        skills=[
            CVSkill(name="Python"),
            CVSkill(name="Docker"),
            CVSkill(name="PostgreSQL"),
            CVSkill(name="AWS"),
        ],
        experience=[
            CVExperience(
                company="DataFlow Inc",
                title="Backend Engineer",
                bullets=[
                    "Built and deployed REST APIs using FastAPI and PostgreSQL.",
                    "Containerized microservices with Docker for development environments.",
                    "Configured AWS EC2 instances for staging deployments via shell scripts.",
                    "Set up automated database backups and monitoring alerts.",
                ],
                technologies=["Python", "FastAPI", "Docker", "PostgreSQL", "AWS", "Bash"],
                achievements=["Reduced deployment time by 40% with containerized workflows."],
            )
        ],
    ),
    "job": StructuredJob(
        job_title="DevOps Engineer",
        required_skills=[
            JobSkill(name="Docker", priority="must_have"),
            JobSkill(name="CI/CD", priority="must_have"),
            JobSkill(name="Kubernetes", priority="preferred"),
            JobSkill(name="Terraform", priority="preferred"),
        ],
        keywords_ats=["DevOps", "containerization", "deployment automation", "infrastructure"],
        tools_and_technologies=["Docker", "Jenkins", "Kubernetes", "Terraform", "Ansible"],
        required_experience=RequiredExperience(min_years=3),
    ),
    "expected_explicit": ["Docker"],
    "expected_latent": ["deployment automation", "CI/CD"],
    "expected_missing": ["Kubernetes", "Terraform", "Ansible", "Jenkins"],
    "unsafe_phrases_to_avoid": [
    ],
}

SCENARIO_3 = {
    "name": "Data Analyst → Product Manager",
    "cv": StructuredCV(
        basics=CVBasics(full_name="Maria Torres"),
        summary="Data analyst with experience in SQL, stakeholder communication, and product metrics.",
        skills=[
            CVSkill(name="SQL"),
            CVSkill(name="Python"),
            CVSkill(name="Tableau"),
            CVSkill(name="Excel"),
        ],
        experience=[
            CVExperience(
                company="RetailCorp",
                title="Data Analyst",
                bullets=[
                    "Gathered requirements from stakeholders for monthly product performance reports.",
                    "Analyzed user behavior data with SQL to identify drop-off points in the funnel.",
                    "Presented data-driven recommendations to product and executive teams.",
                    "Built dashboards in Tableau to track KPIs and product metrics.",
                ],
                technologies=["SQL", "Python", "Tableau", "Excel", "Google Analytics"],
                achievements=[
                    "Identified a 15% conversion opportunity through funnel analysis."
                ],
            )
        ],
    ),
    "job": StructuredJob(
        job_title="Product Manager",
        required_skills=[
            JobSkill(name="stakeholder management", priority="must_have"),
            JobSkill(name="product strategy", priority="must_have"),
            JobSkill(name="data analysis", priority="must_have"),
            JobSkill(name="A/B testing", priority="preferred"),
        ],
        keywords_ats=["roadmap", "product", "strategy", "metrics", "user research"],
        tools_and_technologies=["Jira", "Amplitude", "Mixpanel"],
        required_experience=RequiredExperience(min_years=3),
    ),
    "expected_explicit": ["stakeholder management", "data analysis"],
    "expected_latent": ["product strategy"],
    "expected_missing": ["A/B testing", "Jira", "Amplitude", "Mixpanel"],
    "unsafe_phrases_to_avoid": [
        "managed product roadmap",
        "defined OKRs",
        "owned sprint planning",
    ],
}


# ---------------------------------------------------------------------------
# Negative cases: LLM commonly misclassifies these as latent_match when
# they should be explicit_match (paraphrase noise, no domain translation)
# ---------------------------------------------------------------------------

NEGATIVE_LATENT_CASES = [
    {
        "skill": "Optimización del rendimiento",
        "evidence": "Optimicé consultas SQL en Microsoft SQL Server para mejorar rendimiento y mantenibilidad.",
        "suggested_phrase": "Optimización de consultas SQL para mejorar el rendimiento",
        "expected_status": "explicit_match",
        "reason": "paraphrase — evidence already conveys performance optimization directly",
    },
    {
        "skill": "Data Engineering",
        "evidence": "Desarrollé y mantuve procesos ETL utilizando Apache Airflow sobre Google Cloud Platform.",
        "suggested_phrase": "Experiencia en ingeniería de datos con procesos ETL y Apache Airflow",
        "expected_status": "explicit_match",
        "reason": "paraphrase — ETL/Airflow/data engineering already explicit in evidence",
    },
    {
        "skill": "Software Engineering",
        "evidence": "Diseñé una arquitectura modular enfocada en escalabilidad, bajo acoplamiento y facilidad de mantenimiento.",
        "suggested_phrase": "Experiencia en desarrollo de software con enfoque en arquitectura modular",
        "expected_status": "explicit_match",
        "reason": "paraphrase — software architecture already explicit in evidence",
    },
]


# ---------------------------------------------------------------------------
# Positive cases: real domain translations that should stay latent_match
# Includes cases with partial lexical overlap (tricky for the post-check)
# ---------------------------------------------------------------------------

POSITIVE_LATENT_CASES = [
    {
        "skill": "regression testing",
        "evidence": "Fixed edge-case rendering bugs reported by QA team.",
        "suggested_phrase": "Applied regression testing judgment to identify and resolve UI edge cases.",
        "job_terms": {"qa", "testing", "regression"},
        "expected_status": "latent_match",
        "reason": "real domain translation — evidence doesn't mention 'regression testing'",
    },
    {
        "skill": "deployment automation",
        "evidence": "Configured AWS EC2 instances for staging deployments via shell scripts.",
        "suggested_phrase": "Automated deployment tasks in cloud environments through scripting.",
        "job_terms": {"deployment", "automation", "devops", "cloud"},
        "expected_status": "latent_match",
        "reason": "real domain translation — 'deployment automation' not explicit in evidence",
    },
    {
        "skill": "product strategy",
        "evidence": "Analyzed user behavior data with SQL to identify drop-off points in the funnel and presented recommendations.",
        "suggested_phrase": "Contributed to product strategy by analyzing user behavior data and identifying improvement opportunities.",
        "job_terms": {"product", "strategy", "roadmap", "metrics"},
        "expected_status": "latent_match",
        "reason": "real domain translation — 'product strategy' not mentioned in evidence",
    },
    {
        "skill": "cloud security engineering",
        "evidence": "Configuré buckets de almacenamiento en la nube con políticas de acceso restringido.",
        "suggested_phrase": "Applied cloud access controls and storage security best practices.",
        "job_terms": {"cloud", "security", "access", "storage"},
        "expected_status": "latent_match",
        "reason": "real domain translation — 'security engineering' not explicit despite 'nube' overlap",
    },
]


def get_all_scenarios() -> list[dict]:
    return [SCENARIO_1, SCENARIO_2, SCENARIO_3]


def get_negative_latent_cases() -> list[dict]:
    return NEGATIVE_LATENT_CASES


def get_positive_latent_cases() -> list[dict]:
    return POSITIVE_LATENT_CASES
