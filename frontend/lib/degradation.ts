import type { ProcessingMetadata, StructuredCV } from "@/types/cv";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, MatchScoreResult } from "@/types/scoring";

/**
 * Every pipeline step can silently degrade to a deterministic fallback when the
 * LLM call fails. The backend already reports which path ran (`strategy`), but
 * only two of the five results ever surfaced it, so a regex-parsed CV could
 * reach the PDF export without the user ever being told.
 *
 * This module turns those flags into something renderable.
 */

export type DegradedStep = {
  id: string;
  /** Pipeline stage, as the user understands it. */
  label: string;
  /** What the user is actually looking at because of the degradation. */
  detail: string;
  /** Best guess at the cause, derived from the backend warnings. */
  cause: string;
};

const MISSING_KEY_HINT = "Falta la API key o el modelo no está bien configurado.";
const PROVIDER_FAILED_HINT = "El proveedor de IA no respondió correctamente.";

/** Backend warnings are free text; classify them instead of showing them raw. */
function describeCause(meta?: ProcessingMetadata | null): string {
  const warnings = meta?.warnings ?? [];
  const joined = warnings.join(" ").toLowerCase();

  if (joined.includes("api key") || joined.includes("modelo configurado")) {
    return MISSING_KEY_HINT;
  }
  if (joined.includes("timeout") || joined.includes("timed out")) {
    return "La llamada al proveedor superó el tiempo de espera.";
  }
  if (joined.includes("json")) {
    return "El proveedor devolvió una respuesta con formato inválido.";
  }
  return PROVIDER_FAILED_HINT;
}

function isHeuristic(strategy?: string): boolean {
  return strategy === "heuristic";
}

export function collectDegradations(input: {
  cv?: StructuredCV | null;
  job?: StructuredJob | null;
  score?: MatchScoreResult;
  adapted?: AdaptedCV;
  adaptedScore?: MatchScoreResult;
}): DegradedStep[] {
  const steps: DegradedStep[] = [];

  // Listed first on purpose: a degraded parse propagates into the score, the
  // adaptation and the exported file, so it is the one worth reading.
  if (isHeuristic(input.cv?.meta?.strategy)) {
    steps.push({
      id: "cv",
      label: "Lectura del CV",
      detail:
        "Se extrajo con reglas de texto, no con IA. Nombres, empresas y cargos pueden estar mal asignados, " +
        "y esos datos se arrastran al análisis, a la adaptación y al archivo exportado.",
      cause: describeCause(input.cv?.meta),
    });
  }

  if (isHeuristic(input.job?.meta?.strategy)) {
    steps.push({
      id: "job",
      label: "Lectura de la vacante",
      detail:
        "Los requisitos se extrajeron por coincidencia de palabras. Puede faltar contexto y confundirse " +
        "lo obligatorio con lo deseable.",
      cause: describeCause(input.job?.meta),
    });
  }

  if (isHeuristic(input.score?.strategy)) {
    steps.push({
      id: "score",
      label: "Compatibilidad",
      detail:
        "El puntaje se calculó contando coincidencias literales de palabras, sin comprensión semántica. " +
        "Una habilidad escrita con otro término cuenta como ausente.",
      cause: PROVIDER_FAILED_HINT,
    });
  }

  if (isHeuristic(input.adapted?.meta?.strategy)) {
    steps.push({
      id: "adapted",
      label: "Adaptación del CV",
      detail:
        "Los bullets no fueron reescritos: solo se les anexaron entre paréntesis las palabras clave que ya " +
        "aparecían. Revisá el borrador antes de exportarlo.",
      cause: describeCause(input.adapted?.meta),
    });
  }

  if (isHeuristic(input.adaptedScore?.strategy)) {
    steps.push({
      id: "adaptedScore",
      label: "Compatibilidad del CV adaptado",
      detail:
        "El recálculo usó el conteo de palabras, no IA. No es comparable con un puntaje inicial hecho con IA.",
      cause: PROVIDER_FAILED_HINT,
    });
  }

  return steps;
}
