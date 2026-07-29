import type { ProcessingMetadata, StructuredCV } from "@/types/cv";
import type { StructuredJob } from "@/types/job";

export type ScoreWeights = {
  skills: number;
  experience: number;
  education: number;
  keywords_ats: number;
};

export type CompatibilityStrength = {
  area: string;
  explanation: string;
};

export type CompatibilityGap = {
  area: string;
  severity: "bloqueante" | "superable" | "menor";
  explanation: string;
  bridge: string;
};

export type TransferableSkill = {
  skill: string;
  context: string;
};

export type MatchScoreResult = {
  score: number;
  compatibility: "alta" | "media" | "baja";
  summary: string;
  strengths: CompatibilityStrength[];
  gaps: CompatibilityGap[];
  transferable_skills: TransferableSkill[];
  recommendations: string[];
  strategy: "llm" | "heuristic" | "failed";
};

export type LatentSkill = {
  skill: string;
  evidence: string;
};

export type SkillCoverageItem = {
  skill: string;
  status: "explicit_match" | "latent_match" | "missing";
  evidence: string;
  suggested_phrase: string;
};

export type LatentProposal = {
  skill: string;
  evidence: string;
  suggested_phrase: string;
  experience_context: string;
};

/** Deterministic before/after of the adaptation. Computed without an LLM, so
 *  unlike the score delta it is reproducible for the same CV + vacancy. */
export type AdaptationImpact = {
  skills_newly_covered: string[];
  skills_already_covered: string[];
  skills_still_missing: string[];
  bullets_total: number;
  bullets_rewritten: number;
};

export type AdaptedCV = {
  adapted_summary: string;
  adapted_experience: Array<{
    company: string;
    title: string;
    rewritten_bullets: string[];
    bullet_was_rewritten: boolean[];
    keywords_emphasized: string[];
  }>;
  added_keywords: string[];
  missing_skills: string[];
  latent_skills: LatentSkill[];
  warnings: string[];
  source_cv?: StructuredCV | null;
  meta: ProcessingMetadata;
  skill_coverage?: SkillCoverageItem[];
  latent_proposals?: LatentProposal[];
  impact?: AdaptationImpact | null;
};

export type MatchFlowState = {
  cv?: StructuredCV;
  job?: StructuredJob;
  score?: MatchScoreResult;
  adapted?: AdaptedCV;
};
