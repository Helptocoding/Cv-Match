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
  strategy: string;
};

export type LatentSkill = {
  skill: string;
  evidence: string;
};

export type AdaptedCV = {
  adapted_summary: string;
  adapted_experience: Array<{
    company: string;
    title: string;
    rewritten_bullets: string[];
    keywords_emphasized: string[];
  }>;
  added_keywords: string[];
  missing_skills: string[];
  latent_skills: LatentSkill[];
  warnings: string[];
  source_cv?: StructuredCV | null;
  meta: ProcessingMetadata;
};

export type MatchFlowState = {
  cv?: StructuredCV;
  job?: StructuredJob;
  score?: MatchScoreResult;
  adapted?: AdaptedCV;
};
