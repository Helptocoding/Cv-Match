import type { ApplicationRecord } from "@/types/application";

const APPLICATIONS_KEY = "cv-matcher-applications-v1";

function isApplicationRecord(value: unknown): value is ApplicationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ApplicationRecord>;
  return typeof record.id === "string"
    && typeof record.createdAt === "string"
    && typeof record.updatedAt === "string"
    && typeof record.status === "string"
    && typeof record.notes === "string"
    && typeof record.nextAction === "string"
    && typeof record.jobText === "string"
    && Boolean(record.job && typeof record.job === "object");
}

export function loadApplications(): ApplicationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(APPLICATIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid application data");
    return parsed.filter(isApplicationRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveApplications(applications: ApplicationRecord[]) {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
    return true;
  } catch {
    return false;
  }
}
