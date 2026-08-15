"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, MatchScoreResult } from "@/types/scoring";

type Props = {
  score?: MatchScoreResult;
  adaptedScore?: MatchScoreResult;
  adapted?: AdaptedCV;
  job?: StructuredJob | null;
};

const severityStyle = {
  bloqueante: "border-red-200 bg-red-50 text-red-800",
  superable: "border-amber-200 bg-amber-50 text-amber-800",
  menor: "border-slate-200 bg-slate-50 text-slate-700",
};

export function AtsChecklist({ score, adaptedScore, adapted, job }: Props) {
  if (!score) return null;
  const criticalGaps = score.gaps.filter((gap) => gap.severity === "bloqueante");
  const otherGaps = score.gaps.filter((gap) => gap.severity !== "bloqueante");
  const postAdaptationScore = adaptedScore?.strategy === "failed" ? undefined : adaptedScore;
  const scoreDelta = postAdaptationScore ? postAdaptationScore.score - score.score : undefined;
  const keywordCount = job?.keywords_ats.length ?? 0;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0071e3]/[0.09]">
          <CheckCircle2 size={18} className="text-[#0071e3]" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">Checklist ATS</p>
          <h2 className="mt-0.5 text-base font-semibold text-[#1d1d1f]">Qué conviene resolver antes de postular</h2>
          <p className="mt-1 text-sm leading-5 text-black/55">Basado en el análisis actual. Solo recomienda reforzar evidencia real; no inventa experiencia.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {criticalGaps.map((gap) => (
          <ChecklistItem key={`${gap.area}-${gap.severity}`} gap={gap} />
        ))}
        {otherGaps.slice(0, 3).map((gap) => (
          <ChecklistItem key={`${gap.area}-${gap.severity}`} gap={gap} />
        ))}
        {score.gaps.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
            No se detectaron brechas importantes. Revisá de todos modos que cada logro del CV pueda respaldarse en una entrevista.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#f8fafc] px-3.5 py-3">
          <p className="text-xs font-semibold text-black/55">Palabras clave</p>
          <p className="mt-1 text-sm leading-5 text-black/70">
            {keywordCount > 0
              ? `La vacante contiene ${keywordCount} términos ATS. Priorizá los que ya podés demostrar con un logro o proyecto.`
              : "La vacante no expone términos ATS claros; priorizá responsabilidades y herramientas concretas."}
          </p>
        </div>
        <div className="rounded-2xl bg-[#f8fafc] px-3.5 py-3">
          <p className="text-xs font-semibold text-black/55">Siguiente mejora</p>
          <p className="mt-1 text-sm leading-5 text-black/70">
            {score.recommendations[0] ?? "Adaptá el resumen y los logros con el vocabulario de la vacante que ya puedas respaldar."}
          </p>
        </div>
      </div>

      {adapted && (
        <div className="mt-4 rounded-2xl border border-blue-200/70 bg-blue-50/60 px-3.5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Sparkles size={15} /> Después de adaptar
          </div>
          <p className="mt-1.5 text-sm leading-5 text-blue-800/80">
            {scoreDelta === undefined
              ? "El CV fue adaptado; el recálculo de compatibilidad todavía no está disponible."
              : scoreDelta > 0
                ? `La compatibilidad subió ${scoreDelta} punto${scoreDelta === 1 ? "" : "s"} (${score.score} → ${postAdaptationScore!.score}).`
                : scoreDelta < 0
                  ? `La compatibilidad cambió ${scoreDelta} puntos (${score.score} → ${postAdaptationScore!.score}). Revisá los cambios antes de exportar.`
                  : "La compatibilidad se mantiene; revisá que los cambios hagan más clara la evidencia relevante."}
          </p>
          {adapted.impact?.skills_still_missing.length ? (
            <p className="mt-1.5 text-xs text-blue-800/70">Aún faltan: {adapted.impact.skills_still_missing.join(", ")}.</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function ChecklistItem({ gap }: { gap: MatchScoreResult["gaps"][number] }) {
  const isBlocking = gap.severity === "bloqueante";
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${severityStyle[gap.severity]}`}>
      <div className="flex gap-2.5">
        {isBlocking ? <CircleAlert size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        <div>
          <p className="text-sm font-semibold">{gap.area}</p>
          {gap.explanation && <p className="mt-0.5 text-sm leading-5 opacity-85">{gap.explanation}</p>}
          <p className="mt-1 text-xs leading-5 opacity-80">Acción: {gap.bridge || "No lo agregues sin evidencia; destacá experiencia relacionada que puedas explicar."}</p>
        </div>
      </div>
    </div>
  );
}
