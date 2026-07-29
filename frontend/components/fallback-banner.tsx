"use client";

import { AlertTriangle } from "lucide-react";

import type { DegradedStep } from "@/lib/degradation";


type Props = {
  steps: DegradedStep[];
  onOpenProviderConfig?: () => void;
};

/**
 * Full-width notice listing every pipeline step that ran without AI.
 *
 * Sits above the results instead of inside a panel: a degraded CV parse affects
 * the score, the draft and the export at once, so it does not belong to any
 * single card.
 */
export function FallbackBanner({ steps, onOpenProviderConfig }: Props) {
  if (steps.length === 0) return null;

  const causes = Array.from(new Set(steps.map((s) => s.cause)));

  return (
    <div
      role="alert"
      className="rounded-3xl border border-amber-300/70 bg-amber-50/90 px-5 py-4 animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {steps.length === 1
              ? "Un paso se completó sin IA"
              : `${steps.length} pasos se completaron sin IA`}
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900/75">
            La llamada al modelo falló y se usó un análisis de respaldo por reglas de texto. El
            resultado es de menor calidad que el análisis con IA.
          </p>

          <ul className="mt-3 space-y-2.5">
            {steps.map((step) => (
              <li key={step.id} className="rounded-2xl bg-white/60 px-3.5 py-2.5">
                <p className="text-xs font-semibold text-amber-900">{step.label}</p>
                <p className="mt-1 text-xs leading-5 text-amber-900/75">{step.detail}</p>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-amber-900/60">
              {causes.length === 1 ? causes[0] : "Revisá la configuración del proveedor y reintentá."}
            </p>
            {onOpenProviderConfig && (
              <button
                type="button"
                onClick={onOpenProviderConfig}
                className="rounded-full bg-amber-100 px-3.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 active:scale-[0.97]"
              >
                Revisar proveedor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
