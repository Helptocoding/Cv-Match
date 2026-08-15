import type { CoverLetterResult } from "@/types/cover-letter";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, MatchScoreResult } from "@/types/scoring";

export const APPLICATION_STATUSES = [
  "guardada",
  "aplicada",
  "entrevista",
  "oferta",
  "rechazada",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** A local-only snapshot of a job-search application. Provider keys and the
 * original CV are deliberately excluded: the record stays useful without
 * widening the app's privacy footprint. */
export type ApplicationRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ApplicationStatus;
  notes: string;
  nextAction: string;
  jobText: string;
  job: StructuredJob;
  score?: MatchScoreResult;
  adaptedScore?: MatchScoreResult;
  adapted?: AdaptedCV;
  coverLetter?: CoverLetterResult | null;
};
