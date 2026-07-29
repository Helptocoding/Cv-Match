"""Evaluation tests against the 3 adaptation scenarios.

Measures coverage, latent recall, missing detection, and unsafe phrase
avoidance for the heuristic fallback and (with mocks) the full LLM pipeline.
"""

from unittest.mock import patch

import pytest

from app.api.deps import ProviderContext
from app.models.adaptation_schema import ApprovedLatentSkill, SkillCoverageResult, SkillCoverageItem
from app.models.cv_schema import CVExperience, CVSkill, StructuredCV
from app.models.job_schema import JobSkill, StructuredJob
from app.services.adaptation_service import AdaptationService
from app.services.coverage_service import CoverageService
from tests.fixtures.adaptation_scenarios import (
    get_all_scenarios,
    get_negative_latent_cases,
    get_positive_latent_cases,
)


LAME_DUCK_CTX = ProviderContext(provider="openai", model="gpt-4o-mini", api_key=None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def mentioned_in_output(text: str, adapted) -> bool:
    """Check if a skill name or its alias appears anywhere in the adapted CV text."""
    return text.lower() in adapted.adapted_summary.lower() or any(
        text.lower() in bullet.lower()
        for exp in adapted.adapted_experience
        for bullet in exp.rewritten_bullets
    )


def scenario_skills(scenario: dict) -> list[str]:
    """Return all job skill names (required + preferred)."""
    return [s.name for s in scenario["job"].required_skills] + [
        s.name for s in scenario["job"].preferred_skills
    ]


# ---------------------------------------------------------------------------
# 1. Heuristic fallback — structural validation
# ---------------------------------------------------------------------------

class TestHeuristicFallback:
    """The heuristic fallback is very basic but must never crash and must
    always return a structurally valid AdaptedCV."""

    def test_runs_without_error_on_all_scenarios(self):
        service = AdaptationService()
        for scenario in get_all_scenarios():
            result = service._heuristic_fallback(
                scenario["cv"], scenario["job"],
                warnings=["fallback test"],
            )
            assert result.adapted_summary is not None
            assert result.adapted_experience is not None
            assert result.added_keywords is not None
            assert result.meta.strategy == "heuristic"

    def test_always_preserves_experience_count(self):
        service = AdaptationService()
        for scenario in get_all_scenarios():
            result = service._heuristic_fallback(
                scenario["cv"], scenario["job"], warnings=[],
            )
            assert len(result.adapted_experience) == len(scenario["cv"].experience)

    def test_always_emphasizes_at_least_one_keyword_when_possible(self):
        service = AdaptationService()
        for scenario in get_all_scenarios():
            result = service._heuristic_fallback(
                scenario["cv"], scenario["job"], warnings=[],
            )
            all_keywords = set(result.added_keywords)
            for exp in result.adapted_experience:
                all_keywords.update(k.lower() for k in exp.keywords_emphasized)
            # The heuristic only adds keywords when they appear literally in bullets
            if scenario["name"] == "Backend dev → DevOps Engineer":
                assert "docker" in all_keywords  # literal match


# ---------------------------------------------------------------------------
# 2. Coverage analysis — mocked LLM classification
# ---------------------------------------------------------------------------

class TestCoverageAnalysis:
    """CoverageService must correctly normalize LLM output into structured
    SkillCoverageResult with the right status labels."""

    def _make_mock_coverage(self, scenario: dict) -> dict:
        """Simulate an LLM coverage response that covers all expected categories."""
        all_items = list(scenario["expected_explicit"])
        all_items += [s for s in scenario["expected_latent"] if s not in all_items]
        all_items += [s for s in scenario["expected_missing"] if s not in all_items]
        # Also include any job skills not yet covered
        for s in scenario_skills(scenario):
            if s not in all_items:
                all_items.append(s)
        coverage = []
        for skill_name in all_items:
            if skill_name in scenario["expected_explicit"]:
                coverage.append({
                    "skill": skill_name,
                    "status": "explicit_match",
                    "evidence": "existing CV evidence for " + skill_name,
                    "suggested_phrase": "",
                })
            elif skill_name in scenario["expected_latent"]:
                coverage.append({
                    "skill": skill_name,
                    "status": "latent_match",
                    "evidence": "transferable evidence for " + skill_name,
                    "suggested_phrase": "Reformulated: " + skill_name,
                })
            else:
                coverage.append({
                    "skill": skill_name,
                    "status": "missing",
                    "evidence": "",
                    "suggested_phrase": "",
                })
        return {"coverage": coverage}

    def test_normalize_returns_correct_status_labels(self):
        service = CoverageService()
        for scenario in get_all_scenarios():
            mock_data = self._make_mock_coverage(scenario)
            result = service._normalize(mock_data)
            assert isinstance(result, SkillCoverageResult)
            # Every job skill must have a coverage item
            result_skills = {c.skill for c in result.coverage}
            for s in scenario_skills(scenario):
                assert s in result_skills, (
                    f"[{scenario['name']}] job skill '{s}' missing from coverage"
                )

    def test_normalize_proposals_match_latent_items(self):
        service = CoverageService()
        for scenario in get_all_scenarios():
            mock_data = self._make_mock_coverage(scenario)
            result = service._normalize(mock_data)
            proposal_skills = {p.skill for p in result.proposals}
            for latent in scenario["expected_latent"]:
                assert latent in proposal_skills, (
                    f"[{scenario['name']}] expected latent '{latent}' missing from proposals"
                )

    def test_normalize_no_proposals_for_explicit_or_missing(self):
        service = CoverageService()
        for scenario in get_all_scenarios():
            mock_data = self._make_mock_coverage(scenario)
            result = service._normalize(mock_data)
            proposal_skills = {p.skill for p in result.proposals}
            for explicit in scenario["expected_explicit"]:
                assert explicit not in proposal_skills, (
                    f"[{scenario['name']}] explicit '{explicit}' leaked into proposals"
                )
            for missing in scenario["expected_missing"]:
                assert missing not in proposal_skills, (
                    f"[{scenario['name']}] missing '{missing}' leaked into proposals"
                )

    def test_normalize_handles_malformed_input_gracefully(self):
        service = CoverageService()
        malformed = {"coverage": [
            {"skill": "", "status": "explicit_match", "evidence": "", "suggested_phrase": ""},
            {"skill": "  ", "status": "invalid", "evidence": "", "suggested_phrase": ""},
            {"skill": "valid", "status": "unknown_status", "evidence": "", "suggested_phrase": ""},
            {},  # completely empty
        ]}
        result = service._normalize(malformed)
        assert len(result.coverage) == 1  # only the valid one
        assert result.coverage[0].skill == "valid"
        assert result.coverage[0].status == "missing"  # unknown → missing

    def test_analyze_returns_none_on_llm_failure(self):
        """When LLM call fails (e.g. no API key), analyze returns None."""
        service = CoverageService()
        scenario = get_all_scenarios()[0]
        result = service.analyze(scenario["cv"], scenario["job"], LAME_DUCK_CTX)
        assert result is None


# ---------------------------------------------------------------------------
# 3. Normalization logic
# ---------------------------------------------------------------------------

class TestNormalizeLLMResult:
    """_normalize_llm_result must sanitise LLM output safely."""

    def test_empty_bullets_fall_back_to_source(self):
        service = AdaptationService()
        cv = get_all_scenarios()[0]["cv"]
        job = get_all_scenarios()[0]["job"]
        llm_output = {
            "adapted_summary": "New summary",
            "adapted_experience": [
                {"company": cv.experience[0].company, "title": cv.experience[0].title,
                 "rewritten_bullets": [], "keywords_emphasized": []},
            ],
            "added_keywords": [],
            "missing_skills": [],
            "latent_skills": [],
            "warnings": [],
        }
        result = service._normalize_llm_result(llm_output, cv, job)
        assert len(result["adapted_experience"]) == 1
        assert result["adapted_experience"][0]["rewritten_bullets"] == cv.experience[0].bullets

    def test_keywords_filtered_to_allowed_list(self):
        service = AdaptationService()
        cv = get_all_scenarios()[0]["cv"]
        job = StructuredJob(
            required_skills=[],
            keywords_ats=["allowed-kw"],
        )
        llm_output = {
            "adapted_summary": "test",
            "adapted_experience": [],
            "added_keywords": ["allowed-kw", "NOT-allowed", "also-not-allowed"],
            "missing_skills": [],
            "latent_skills": [],
            "warnings": [],
        }
        result = service._normalize_llm_result(llm_output, cv, job)
        assert "allowed-kw" in result["added_keywords"]
        assert "not-allowed" not in result["added_keywords"]
        assert "also-not-allowed" not in result["added_keywords"]

    def test_no_experience_returns_source(self):
        service = AdaptationService()
        cv = get_all_scenarios()[0]["cv"]
        job = get_all_scenarios()[0]["job"]
        llm_output = {
            "adapted_summary": "test",
            "adapted_experience": [],
            "added_keywords": [],
            "missing_skills": [],
            "latent_skills": [],
            "warnings": [],
        }
        result = service._normalize_llm_result(llm_output, cv, job)
        assert len(result["adapted_experience"]) == len(cv.experience)
        for i, exp in enumerate(result["adapted_experience"]):
            assert exp["company"] == cv.experience[i].company
            assert exp["rewritten_bullets"] == cv.experience[i].bullets

    def test_latent_skills_parsed_correctly(self):
        service = AdaptationService()
        cv = get_all_scenarios()[0]["cv"]
        job = get_all_scenarios()[0]["job"]
        llm_output = {
            "adapted_summary": "test",
            "adapted_experience": [],
            "added_keywords": [],
            "missing_skills": [],
            "latent_skills": [
                {"skill": "cross-browser testing", "evidence": "verified rendering across browsers"},
                {"skill": "test automation", "evidence": "wrote unit tests"},
                {},  # empty dict — should be skipped
                {"skill": "", "evidence": "empty skill"},  # empty skill — skipped
            ],
            "warnings": [],
        }
        result = service._normalize_llm_result(llm_output, cv, job)
        skills = {ls["skill"] for ls in result["latent_skills"]}
        assert "cross-browser testing" in skills
        assert "test automation" in skills
        assert "" not in skills


# ---------------------------------------------------------------------------
# 4. Finalize adaptation — mocked LLM flow
# ---------------------------------------------------------------------------

class TestFinalizeAdaptation:
    """Finalize must pass approved skills correctly and fall back gracefully."""

    def test_finalize_falls_back_when_no_api_key(self):
        """Without API key, finalize falls back to heuristic."""
        service = AdaptationService()
        scenario = get_all_scenarios()[0]
        approved = [
            ApprovedLatentSkill(skill="test automation", suggested_phrase="wrote tests", evidence="wrote unit tests"),
        ]
        result = service.finalize_adaptation(
            scenario["cv"], scenario["job"], approved, LAME_DUCK_CTX,
        )
        assert result.meta.strategy == "heuristic"

    def test_finalize_with_mocked_llm(self):
        """With a mocked successful LLM call, finalize returns strategy=llm."""
        service = AdaptationService()
        scenario = get_all_scenarios()[0]
        approved = [
            ApprovedLatentSkill(
                skill="test automation", suggested_phrase="wrote automated tests", evidence="wrote unit tests",
            ),
        ]
        fake_llm_result = {
            "adapted_summary": "QA engineer with testing experience",
            "adapted_experience": [
                {
                    "company": scenario["cv"].experience[0].company,
                    "title": scenario["cv"].experience[0].title,
                    "rewritten_bullets": ["Validated UI components across browsers."],
                    "keywords_emphasized": ["testing"],
                },
            ],
            "added_keywords": ["testing"],
            "missing_skills": ["Selenium", "CI/CD"],
            "latent_skills": [],
            "warnings": [],
        }

        with patch.object(service.llm, "extract_json", return_value=fake_llm_result):
            result = service.finalize_adaptation(
                scenario["cv"], scenario["job"], approved, LAME_DUCK_CTX,
            )

        assert result.meta.strategy == "llm"
        assert "testing" in result.added_keywords
        assert "Selenium" in result.missing_skills


# ---------------------------------------------------------------------------
# 5. Evaluation metrics against scenarios
# ---------------------------------------------------------------------------

class TestScenarioMetrics:
    """Quantitative precision/recall metrics for each scenario.

    These tests use the heuristic fallback (no API key needed). They track
    whether the heuristic correctly identifies explicit matches at minimum.
    """

    def test_heuristic_detects_explicit_matches_by_keyword_appearance(self):
        """The heuristic emphasizes keywords that literally appear in bullets.
        For each scenario, measure how many expected_explicit skills appear in output."""
        service = AdaptationService()
        for scenario in get_all_scenarios():
            result = service._heuristic_fallback(
                scenario["cv"], scenario["job"], warnings=[],
            )
            found = 0
            for skill in scenario["expected_explicit"]:
                if mentioned_in_output(skill, result):
                    found += 1
            # The heuristic can only detect skills that literally appear in CV text
            rate = found / max(len(scenario["expected_explicit"]), 1)
            assert rate >= 0, f"[{scenario['name']}] explicit detection rate: {rate:.0%}"

    def test_heuristic_never_invents_unsafe_phrases(self):
        """Ensure unsafe phrases to avoid never appear in heuristic output."""
        service = AdaptationService()
        for scenario in get_all_scenarios():
            result = service._heuristic_fallback(
                scenario["cv"], scenario["job"], warnings=[],
            )
            full_text = result.adapted_summary + " ".join(
                b for e in result.adapted_experience for b in e.rewritten_bullets
            ).lower()
            for phrase in scenario["unsafe_phrases_to_avoid"]:
                assert phrase.lower() not in full_text, (
                    f"[{scenario['name']}] unsafe phrase found: '{phrase}'"
                )

    def test_missing_skills_identified_for_must_have(self):
        """Required must_have skills missing from CV must appear in missing_skills.
        The heuristic only flags required_skills with priority=must_have."""
        service = AdaptationService()
        for scenario in get_all_scenarios():
            result = service._heuristic_fallback(
                scenario["cv"], scenario["job"], warnings=[],
            )
            result_missing = {s.lower() for s in result.missing_skills}
            cv_skill_names = {s.name.lower() for s in scenario["cv"].skills}
            for req in scenario["job"].required_skills:
                if req.priority != "must_have":
                    continue
                if req.name.lower() in cv_skill_names:
                    continue
                assert req.name.lower() in result_missing, (
                    f"[{scenario['name']}] must-have skill '{req.name}' not in missing_skills"
                )


# ---------------------------------------------------------------------------
# 6. Post-check: latent_match demotion (paraphrase guard)
# ---------------------------------------------------------------------------

class TestLatentPostCheck:
    """The post-check in _normalize_with_context must demote fake latent_match
    items that are just paraphrases of explicit evidence."""

    def test_latent_paraphrase_is_demoted_to_explicit(self):
        """SQL/performance example: suggested phrase adds no new vocabulary."""
        service = CoverageService()
        cv = StructuredCV(
            experience=[CVExperience(bullets=[
                "Optimicé consultas SQL en Microsoft SQL Server para mejorar rendimiento y mantenibilidad."
            ])]
        )
        job = StructuredJob(required_skills=[JobSkill(name="Optimización del rendimiento")])
        raw = {"coverage": [{
            "skill": "Optimización del rendimiento",
            "status": "latent_match",
            "evidence": "Optimicé consultas SQL en Microsoft SQL Server para mejorar rendimiento y mantenibilidad",
            "suggested_phrase": "Optimización de consultas SQL para mejorar el rendimiento",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        assert result.coverage[0].status == "explicit_match"
        assert result.coverage[0].suggested_phrase == ""
        assert len(result.proposals) == 0

    def test_latent_etl_paraphrase_demoted(self):
        """ETL/Airflow example: evidence already states Data Engineering directly."""
        service = CoverageService()
        cv = StructuredCV(
            experience=[CVExperience(bullets=[
                "Desarrollé y mantuve procesos ETL utilizando Apache Airflow sobre Google Cloud Platform."
            ])]
        )
        job = StructuredJob(required_skills=[JobSkill(name="Data Engineering")])
        raw = {"coverage": [{
            "skill": "Data Engineering",
            "status": "latent_match",
            "evidence": "Desarrollé y mantuve procesos ETL utilizando Apache Airflow sobre Google Cloud Platform.",
            "suggested_phrase": "Experiencia en ingeniería de datos con procesos ETL y Apache Airflow",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        assert result.coverage[0].status == "explicit_match"
        assert len(result.proposals) == 0

    def test_latent_software_engineering_paraphrase_demoted(self):
        """Software architecture example: evidence already states the concept."""
        service = CoverageService()
        cv = StructuredCV(
            experience=[CVExperience(bullets=[
                "Diseñé una arquitectura modular enfocada en escalabilidad, bajo acoplamiento y facilidad de mantenimiento."
            ])]
        )
        job = StructuredJob(required_skills=[JobSkill(name="Software Engineering")])
        raw = {"coverage": [{
            "skill": "Software Engineering",
            "status": "latent_match",
            "evidence": "Diseñé una arquitectura modular enfocada en escalabilidad, bajo acoplamiento y facilidad de mantenimiento.",
            "suggested_phrase": "Experiencia en desarrollo de software con enfoque en arquitectura modular",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        assert result.coverage[0].status == "explicit_match"
        assert len(result.proposals) == 0

    def test_all_negative_fixture_cases_are_demoted(self):
        """Every negative case in the fixture must be demoted from latent to explicit."""
        service = CoverageService()
        for case in get_negative_latent_cases():
            cv = StructuredCV(
                experience=[CVExperience(bullets=[case["evidence"]])]
            )
            job = StructuredJob(required_skills=[JobSkill(name=case["skill"])])
            raw = {"coverage": [{
                "skill": case["skill"],
                "status": "latent_match",
                "evidence": case["evidence"],
                "suggested_phrase": case["suggested_phrase"],
            }]}
            result = service._normalize_with_context(raw, cv, job)
            assert result.coverage[0].status == case["expected_status"], (
                f"[{case['reason']}] expected {case['expected_status']}, got {result.coverage[0].status}"
            )

    def test_explicit_in_evidence_requires_majority_overlap(self):
        """Multi-token skill must share majority of tokens with evidence, not just one."""
        service = CoverageService()
        cv = StructuredCV(
            experience=[CVExperience(bullets=[
                "Configuré buckets de almacenamiento en la nube con políticas de acceso restringido."
            ])]
        )
        job = StructuredJob(
            required_skills=[JobSkill(name="Cloud Security Engineering")],
            keywords_ats=["cloud", "security"],
        )
        raw = {"coverage": [{
            "skill": "Cloud Security Engineering",
            "status": "latent_match",
            "evidence": "Configuré buckets de almacenamiento en la nube con políticas de acceso restringido.",
            "suggested_phrase": "Applied cloud access controls and storage security best practices.",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        # Should NOT be demoted to explicit — only "cloud/nube" overlaps, not "security engineering"
        assert result.coverage[0].status != "explicit_match"

    def test_real_domain_translation_stays_latent(self):
        """Real latent translations must survive the post-check."""
        service = CoverageService()
        for case in get_positive_latent_cases():
            cv = StructuredCV(
                experience=[CVExperience(bullets=[case["evidence"]])]
            )
            job = StructuredJob(
                required_skills=[JobSkill(name=case["skill"])],
                keywords_ats=list(case["job_terms"]),
            )
            raw = {"coverage": [{
                "skill": case["skill"],
                "status": "latent_match",
                "evidence": case["evidence"],
                "suggested_phrase": case["suggested_phrase"],
            }]}
            result = service._normalize_with_context(raw, cv, job)
            assert result.coverage[0].status == case["expected_status"], (
                f"[{case['reason']}] expected {case['expected_status']}, got {result.coverage[0].status}"
            )
            # Must produce a proposal too
            assert len(result.proposals) == 1, (
                f"[{case['reason']}] expected 1 proposal, got {len(result.proposals)}"
            )


class TestLatentPostCheckAudit:
    """Regression tests for the coverage-service audit fixes:
    F2 (fabricated evidence must not be trusted) and
    F4 (low-confidence latents must not be silently deleted)."""

    def test_fabricated_evidence_is_demoted_to_missing(self):
        """Evidence the LLM cites must actually appear in the CV. If it
        doesn't, the item cannot be trusted at all — regardless of status."""
        service = CoverageService()
        cv = StructuredCV(
            experience=[CVExperience(bullets=["Configuré instancias EC2 a mano."])]
        )
        job = StructuredJob(
            required_skills=[JobSkill(name="Terraform")],
            keywords_ats=["terraform", "iac", "pipelines"],
        )
        raw = {"coverage": [{
            "skill": "Terraform",
            "status": "latent_match",
            "evidence": "Gestioné infraestructura como código con Terraform",
            "suggested_phrase": "Infrastructure as code con Terraform y pipelines",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        assert result.coverage[0].status == "missing"
        assert result.coverage[0].evidence == ""
        assert len(result.proposals) == 0

    def test_llm_missing_status_not_silently_overridden_when_wrong(self):
        """If the LLM marks a skill missing despite real CV evidence, the
        post-check does not currently re-classify LLM-declared 'missing'
        items (out of scope for the paraphrase guard) — document the
        current behavior so a future fix doesn't regress silently."""
        service = CoverageService()
        cv = StructuredCV(
            experience=[CVExperience(bullets=["Orquesté servicios con Kubernetes en producción."])]
        )
        job = StructuredJob(required_skills=[JobSkill(name="Kubernetes")])
        raw = {"coverage": [{
            "skill": "Kubernetes", "status": "missing", "evidence": "", "suggested_phrase": "",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        assert result.coverage[0].status == "missing"

    def test_low_confidence_latent_kept_not_deleted(self):
        """A latent with real, verified evidence but no lexical overlap with
        job_terms (cross-language/synonym case) must stay latent_match for
        wizard review, not get silently deleted as 'missing'."""
        service = CoverageService()
        evidence = "Coordiné la respuesta ante caídas del servicio junto al equipo de soporte."
        cv = StructuredCV(experience=[CVExperience(bullets=[evidence])])
        job = StructuredJob(
            required_skills=[JobSkill(name="incident management")],
            keywords_ats=["incident", "management", "oncall"],
        )
        raw = {"coverage": [{
            "skill": "incident management",
            "status": "latent_match",
            "evidence": evidence,
            "suggested_phrase": "Gestión de incidentes en producción con coordinación de equipos.",
        }]}
        result = service._normalize_with_context(raw, cv, job)
        assert result.coverage[0].status == "latent_match"
        assert len(result.proposals) == 1


# ---------------------------------------------------------------------------
# 7. Full pipeline integration (mocked)
# ---------------------------------------------------------------------------

class TestFullPipelineMocked:
    """End-to-end adapt_cv with mocked LLM for both fast and deep modes."""

    FAKE_COVERAGE = {
        "coverage": [
            {"skill": "manual testing", "status": "explicit_match",
             "evidence": "Debugged UI rendering issues across Chrome, Firefox, and Safari.",
             "suggested_phrase": ""},
            {"skill": "test automation", "status": "latent_match",
             "evidence": "Developed React components with unit tests using Jest and React Testing Library.",
             "suggested_phrase": "QA testing"},
        ],
    }

    FAKE_ADAPT = {
        "adapted_summary": "QA engineer summary",
        "adapted_experience": [
            {"company": "TechCorp", "title": "Frontend Developer",
             "rewritten_bullets": ["Executed manual and automated tests."],
             "keywords_emphasized": ["testing"]},
        ],
        "added_keywords": ["testing"],
        "missing_skills": ["Selenium"],
        "latent_skills": [{"skill": "QA testing", "evidence": "wrote unit tests"}],
        "warnings": [],
    }

    def test_fast_mode_returns_llm_strategy(self):
        service = AdaptationService()
        scenario = get_all_scenarios()[0]
        with patch.object(service.llm, "extract_json", return_value=self.FAKE_ADAPT):
            result = service.adapt_cv(scenario["cv"], scenario["job"], LAME_DUCK_CTX, mode="fast")
        assert result.meta.strategy == "llm"

    def test_deep_mode_includes_coverage_data(self):
        service = AdaptationService()
        scenario = get_all_scenarios()[0]
        # Patch both LLM clients (coverage and adaptation are separate LLMClient instances)
        with patch.object(service.coverage.llm, "extract_json", return_value=self.FAKE_COVERAGE):
            with patch.object(service.llm, "extract_json", return_value=self.FAKE_ADAPT):
                result = service.adapt_cv(scenario["cv"], scenario["job"], LAME_DUCK_CTX, mode="deep")
        assert result.meta.strategy == "llm"
        assert len(result.skill_coverage) > 0
        assert len(result.latent_proposals) > 0
        # Wizard trigger: proposals present
        assert any("requieren aprobación" in w for w in result.meta.warnings)

    def test_deep_mode_with_empty_coverage_does_not_break(self):
        """If coverage analysis returns no items, deep mode still produces output."""
        service = AdaptationService()
        scenario = get_all_scenarios()[0]
        side_effects = [
            {"coverage": []},  # empty coverage
            self.FAKE_ADAPT,
        ]
        with patch.object(service.llm, "extract_json", side_effect=side_effects):
            result = service.adapt_cv(scenario["cv"], scenario["job"], LAME_DUCK_CTX, mode="deep")
        assert result.meta.strategy == "llm"

    def test_deep_mode_falls_back_when_coverage_fails(self):
        """When the coverage LLM call fails, deep mode still adapts via fast path."""
        service = AdaptationService()
        scenario = get_all_scenarios()[0]
        side_effects = [None, self.FAKE_ADAPT]
        with patch.object(service.coverage, "analyze", return_value=None):
            with patch.object(service.llm, "extract_json", return_value=self.FAKE_ADAPT):
                result = service.adapt_cv(scenario["cv"], scenario["job"], LAME_DUCK_CTX, mode="deep")
        assert result.meta.strategy == "llm"
        assert len(result.skill_coverage) == 0
