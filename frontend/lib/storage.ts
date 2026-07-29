import { StructuredCVSchema } from "@/lib/cv-schema";
import type { ProviderConfig } from "@/types/api";
import type { StructuredCV } from "@/types/cv";

const PROVIDER_KEY = "cv-matcher-provider-config";
const RAW_CV_KEY = "cv-matcher-raw-cv-v1";
const PARSED_CV_KEY = "cv-matcher-parsed-cv-v1";
const FILE_NAME_KEY = "cv-matcher-file-name-v1";

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn(
      `localStorage no disponible o lleno — no se pudo guardar "${key}".`,
    );
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ── Provider config — typed ── */

export function saveProviderConfig(config: ProviderConfig) {
  if (typeof window === "undefined") return;
  safeSetItem(PROVIDER_KEY, JSON.stringify(config));
}

export function loadProviderConfig(): ProviderConfig | null {
  if (typeof window === "undefined") return null;
  const raw = safeGetItem(PROVIDER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProviderConfig;
  } catch {
    safeRemoveItem(PROVIDER_KEY);
    return null;
  }
}

export function clearLocalConfig() {
  if (typeof window === "undefined") return;
  safeRemoveItem(PROVIDER_KEY);
}

/* ── Raw CV text ── */

export function saveCvText(text: string) {
  if (typeof window === "undefined") return;
  safeSetItem(RAW_CV_KEY, text);
}

export function loadCvText(): string | null {
  if (typeof window === "undefined") return null;
  return safeGetItem(RAW_CV_KEY);
}

/* ── Parsed CV (with schema validation) ── */

export function saveParsedCv(cv: StructuredCV) {
  if (typeof window === "undefined") return;
  try {
    safeSetItem(PARSED_CV_KEY, JSON.stringify(cv));
  } catch {
    /* already handled by safeSetItem */
  }
}

export function loadParsedCv(): StructuredCV | null {
  if (typeof window === "undefined") return null;
  const raw = safeGetItem(PARSED_CV_KEY);
  if (!raw) return null;
  try {
    return StructuredCVSchema.parse(JSON.parse(raw));
  } catch {
    safeRemoveItem(PARSED_CV_KEY);
    return null;
  }
}

/* ── File name ── */

export function saveFileName(name: string) {
  if (typeof window === "undefined") return;
  safeSetItem(FILE_NAME_KEY, name);
}

export function loadFileName(): string | null {
  if (typeof window === "undefined") return null;
  return safeGetItem(FILE_NAME_KEY);
}

/* ── Clear all CV data ── */

export function clearCvData() {
  if (typeof window === "undefined") return;
  safeRemoveItem(RAW_CV_KEY);
  safeRemoveItem(PARSED_CV_KEY);
  safeRemoveItem(FILE_NAME_KEY);
}
