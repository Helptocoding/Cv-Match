import type { ProviderConfig } from "@/types/api";
import type { ScoreWeights } from "@/types/scoring";

export const DEFAULT_PROVIDER = "groq";
export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_API_KEY = "";

export const DEFAULT_CONFIG: ProviderConfig = {
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
  apiKey: DEFAULT_API_KEY,
  persistKey: false,
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  skills: 0.35,
  experience: 0.3,
  education: 0.15,
  keywords_ats: 0.2
};
