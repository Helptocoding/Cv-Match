import type { ProviderConfig, ProviderValidationResult } from "@/types/api";
import type { StructuredCV } from "@/types/cv";
import type { CoverLetterResult } from "@/types/cover-letter";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, MatchScoreResult, SkillCoverageItem } from "@/types/scoring";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function safeFetch(input: RequestInfo | URL, init: RequestInit | undefined, label: string) {
  try {
    return await fetch(input, init);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`Error de conexión: no se pudo contactar al servidor (${label}).`);
    }
    throw e;
  }
}

function providerHeaders(config: ProviderConfig) {
  return {
    "X-AI-Provider": config.provider,
    "X-AI-Model": config.model,
    "X-Provider-Api-Key": config.apiKey
  };
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    let detail: string;
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`Error del servidor (${label}): ${detail || `HTTP ${response.status}`}.`);
  }
  return response.json() as Promise<T>;
}

/**
 * Asks the backend to ping the provider with these credentials. A prefix check
 * cannot tell an OpenAI key from a DeepSeek one (both are `sk-...`), so the
 * provider's own answer is the only reliable source of truth.
 */
export async function validateProvider(config: ProviderConfig) {
  const response = await safeFetch(`${API_BASE_URL}/provider/validate`, {
    method: "POST",
    headers: providerHeaders(config),
  }, "validar proveedor");

  return parseJsonResponse<ProviderValidationResult>(response, "validar proveedor");
}

export async function parseCV(payload: { rawText?: string; file?: File | null; config: ProviderConfig }) {
  const formData = new FormData();
  if (payload.rawText) {
    formData.append("raw_text", payload.rawText);
  }
  if (payload.file) {
    formData.append("file", payload.file);
  }

  const response = await safeFetch(`${API_BASE_URL}/parse/cv`, {
    method: "POST",
    headers: providerHeaders(payload.config),
    body: formData
  }, "analizar CV");

  return parseJsonResponse<StructuredCV>(response, "analizar CV");
}

export async function parseJob(payload: { rawText: string; config: ProviderConfig }) {
  const formData = new FormData();
  formData.append("raw_text", payload.rawText);

  const response = await safeFetch(`${API_BASE_URL}/parse/job`, {
    method: "POST",
    headers: providerHeaders(payload.config),
    body: formData
  }, "analizar vacante");

  return parseJsonResponse<StructuredJob>(response, "analizar vacante");
}

export async function scoreMatch(payload: { cv: StructuredCV; job: StructuredJob; config: ProviderConfig }) {
  const response = await safeFetch(`${API_BASE_URL}/score/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerHeaders(payload.config),
    },
    body: JSON.stringify({
      cv_structured: payload.cv,
      job_structured: payload.job,
    })
  }, "calcular compatibilidad");

  return parseJsonResponse<MatchScoreResult>(response, "calcular compatibilidad");
}

export async function scoreAdapted(payload: { adapted: AdaptedCV; job: StructuredJob; config: ProviderConfig }) {
  const response = await safeFetch(`${API_BASE_URL}/score/adapted`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerHeaders(payload.config),
    },
    body: JSON.stringify({
      adapted_cv: payload.adapted,
      job_structured: payload.job,
    }),
  }, "recalcular compatibilidad");

  return parseJsonResponse<MatchScoreResult>(response, "recalcular compatibilidad");
}

export async function adaptCV(payload: { cv: StructuredCV; job: StructuredJob; config: ProviderConfig; mode?: string }) {
  const mode = payload.mode ?? "fast";
  const response = await safeFetch(`${API_BASE_URL}/adapt/cv?mode=${encodeURIComponent(mode)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerHeaders(payload.config)
    },
    body: JSON.stringify({
      original_cv_structured: payload.cv,
      job_structured: payload.job
    })
  }, "adaptar CV");

  return parseJsonResponse<AdaptedCV>(response, "adaptar CV");
}

export async function finalizeAdaptation(payload: {
  cv: StructuredCV;
  job: StructuredJob;
  approvedLatentSkills: Array<{ skill: string; suggested_phrase: string; evidence: string }>;
  skillCoverage?: SkillCoverageItem[];
  config: ProviderConfig;
}) {
  const response = await safeFetch(`${API_BASE_URL}/adapt/cv/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...providerHeaders(payload.config) },
    body: JSON.stringify({
      original_cv_structured: payload.cv,
      job_structured: payload.job,
      approved_latent_skills: payload.approvedLatentSkills,
      // Reuse the coverage the wizard already showed — saves an LLM call and
      // keeps finalization consistent with what the candidate approved.
      skill_coverage: payload.skillCoverage ?? null
    })
  }, "finalizar adaptación");
  return parseJsonResponse<AdaptedCV>(response, "finalizar adaptación");
}

export async function generateCoverLetter(payload: { cv: StructuredCV; job: StructuredJob; config: ProviderConfig }) {
  const response = await safeFetch(`${API_BASE_URL}/cover-letter/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerHeaders(payload.config)
    },
    body: JSON.stringify({
      cv: payload.cv,
      job: payload.job,
      tone: "professional"
    })
  }, "generar carta");

  return parseJsonResponse<CoverLetterResult>(response, "generar carta");
}

export async function exportCV(adapted: AdaptedCV, format_: "pdf" | "docx" | "md") {
  switch (format_) {
    case "pdf": return exportPdf({ adapted });
    case "docx": return exportDocx({ adapted });
    case "md": return exportMarkdown({ adapted });
  }
}

export async function exportPdf(payload: { adapted: AdaptedCV; font?: string }) {
  const response = await safeFetch(`${API_BASE_URL}/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adapted_cv: payload.adapted,
      template: "harvard",
      font: payload.font ?? "serif",
    })
  }, "exportar PDF");

  if (!response.ok) {
    throw new Error("Failed to export PDF.");
  }
  return response.blob();
}

export async function fetchPreviewHtml(adapted: AdaptedCV): Promise<string> {
  const response = await safeFetch(`${API_BASE_URL}/export/preview-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapted_cv: adapted, template: "harvard" })
  }, "vista previa");

  if (!response.ok) {
    throw new Error("Failed to load preview.");
  }
  return response.text();
}

export async function exportDocx(payload: { adapted: AdaptedCV }) {
  const response = await safeFetch(`${API_BASE_URL}/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapted_cv: payload.adapted })
  }, "exportar DOCX");

  if (!response.ok) {
    throw new Error("Failed to export DOCX.");
  }
  return response.blob();
}

export async function exportMarkdown(payload: { adapted: AdaptedCV }) {
  const response = await safeFetch(`${API_BASE_URL}/export/markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapted_cv: payload.adapted })
  }, "exportar Markdown");

  if (!response.ok) {
    throw new Error("Failed to export Markdown.");
  }
  return response.blob();
}
