import type { ProviderConfig } from "@/types/api";
import type { StructuredCV } from "@/types/cv";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, MatchScoreResult } from "@/types/scoring";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

function providerHeaders(config: ProviderConfig) {
  return {
    "X-AI-Provider": config.provider,
    "X-AI-Model": config.model,
    "X-Provider-Api-Key": config.apiKey
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed.");
  }
  return response.json() as Promise<T>;
}

export async function parseCV(payload: { rawText?: string; file?: File | null; config: ProviderConfig }) {
  const formData = new FormData();
  if (payload.rawText) {
    formData.append("raw_text", payload.rawText);
  }
  if (payload.file) {
    formData.append("file", payload.file);
  }

  const response = await fetch(`${API_BASE_URL}/parse/cv`, {
    method: "POST",
    headers: providerHeaders(payload.config),
    body: formData
  });

  return parseJsonResponse<StructuredCV>(response);
}

export async function parseJob(payload: { rawText: string; config: ProviderConfig }) {
  const formData = new FormData();
  formData.append("raw_text", payload.rawText);

  const response = await fetch(`${API_BASE_URL}/parse/job`, {
    method: "POST",
    headers: providerHeaders(payload.config),
    body: formData
  });

  return parseJsonResponse<StructuredJob>(response);
}

export async function scoreMatch(payload: { cv: StructuredCV; job: StructuredJob; config: ProviderConfig }) {
  const response = await fetch(`${API_BASE_URL}/score/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerHeaders(payload.config),
    },
    body: JSON.stringify({
      cv_structured: payload.cv,
      job_structured: payload.job,
    })
  });

  return parseJsonResponse<MatchScoreResult>(response);
}

export async function adaptCV(payload: { cv: StructuredCV; job: StructuredJob; config: ProviderConfig }) {
  const response = await fetch(`${API_BASE_URL}/adapt/cv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerHeaders(payload.config)
    },
    body: JSON.stringify({
      original_cv_structured: payload.cv,
      job_structured: payload.job
    })
  });

  return parseJsonResponse<AdaptedCV>(response);
}

export async function exportCV(adapted: AdaptedCV, format_: "pdf" | "docx" | "md") {
  switch (format_) {
    case "pdf": return exportPdf({ adapted });
    case "docx": return exportDocx({ adapted });
    case "md": return exportMarkdown({ adapted });
  }
}

export async function exportPdf(payload: { adapted: AdaptedCV }) {
  const response = await fetch(`${API_BASE_URL}/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapted_cv: payload.adapted, template: "harvard" })
  });

  if (!response.ok) {
    throw new Error("Failed to export PDF.");
  }
  return response.blob();
}

export async function exportDocx(payload: { adapted: AdaptedCV }) {
  const response = await fetch(`${API_BASE_URL}/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapted_cv: payload.adapted })
  });

  if (!response.ok) {
    throw new Error("Failed to export DOCX.");
  }
  return response.blob();
}

export async function exportMarkdown(payload: { adapted: AdaptedCV }) {
  const response = await fetch(`${API_BASE_URL}/export/markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapted_cv: payload.adapted })
  });

  if (!response.ok) {
    throw new Error("Failed to export Markdown.");
  }
  return response.blob();
}
