"use client";

import { useState } from "react";
import clsx from "clsx";
import { ThinkingOrb } from "thinking-orbs";
import { Card } from "@/components/ui/card";
import { finalizeAdaptation } from "@/lib/api";
import type { ProviderConfig } from "@/types/api";
import type { StructuredCV } from "@/types/cv";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, LatentProposal } from "@/types/scoring";


type Props = {
  adapted: AdaptedCV;
  cv: StructuredCV;
  job: StructuredJob;
  config: ProviderConfig;
  onComplete: (finalized: AdaptedCV) => void;
  onCancel: () => void;
};


export function AdaptationWizard({ adapted, cv, job, config, onComplete, onCancel }: Props) {
  const proposals: LatentProposal[] = adapted.latent_proposals || [];
  const totalSteps = proposals.length + 1; // proposals + summary
  const [step, setStep] = useState(0);
  const [approved, setApproved] = useState<{ skill: string; suggested_phrase: string; evidence: string }[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");

  const isProposalStep = step < proposals.length;
  const isSummaryStep = step === proposals.length;

  function handleApprove() {
    const p = proposals[step];
    setApproved(prev => [...prev, { skill: p.skill, suggested_phrase: p.suggested_phrase, evidence: p.evidence }]);
    setStep(prev => prev + 1);
  }

  function handleSkip() {
    setStep(prev => prev + 1);
  }

  function handleBack() {
    if (isSummaryStep && approved.length > 0) {
      // Go back to last proposal
      setStep(proposals.length - 1);
    } else if (isProposalStep && step > 0) {
      // If last item was approved, remove it from approved list
      const wasApproved = approved.some(a => a.skill === proposals[step - 1].skill);
      if (wasApproved) {
        setApproved(prev => prev.slice(0, -1));
      }
      setStep(prev => prev - 1);
    }
  }

  async function handleGenerate() {
    setFinalizing(true);
    setError("");
    try {
      const result = await finalizeAdaptation({
        cv, job, approvedLatentSkills: approved,
        skillCoverage: adapted.skill_coverage,
        config,
      });
      onComplete(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el CV final.");
      setFinalizing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <Card className="relative mx-4 w-full max-w-lg animate-scale-in-bounce p-6">
        {finalizing ? (
          <div className="flex flex-col items-center gap-4 py-12 animate-fade-in">
            <div className="animate-pulse-subtle">
              <ThinkingOrb state="working" size={64} />
            </div>
            <p className="text-sm text-black/55">Generando CV final con las habilidades aprobadas…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-5 flex items-center justify-between animate-fade-in-up" style={{ animationDuration: "0.4s" }}>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-black/45">
                  {isProposalStep ? "Habilidad transferible" : "Resumen de aprobaciones"}
                </p>
                <p className="text-base font-semibold text-ink">
                  {isProposalStep
                    ? `Paso ${step + 1} de ${totalSteps}`
                    : "Paso final"}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full p-1.5 text-black/35 transition-all duration-200 hover:bg-black/[0.05] hover:text-black/60 active:scale-[0.92]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Step indicator */}
            <div className="mb-5 flex gap-1.5 animate-fade-in-up" style={{ animationDelay: "80ms", animationDuration: "0.4s" }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={clsx(
                    "h-1 flex-1 rounded-full transition-all duration-500",
                    i < step ? "bg-green-400" : i === step ? "bg-ink" : "bg-black/[0.08]"
                  )}
                >
                  <div className={clsx(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    i < step ? "bg-green-400 w-full" : "w-0"
                  )} />
                </div>
              ))}
            </div>

            {/* Proposal step */}
            {isProposalStep && (
              <div className="space-y-4 animate-fade-in-up" key={step} style={{ animationDuration: "0.4s" }}>
                <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 px-4 py-3.5 transition-all duration-200 hover:border-violet-300/80 hover:shadow-sm">
                  <p className="text-sm font-semibold text-violet-900">
                    {proposals[step].skill}
                  </p>
                  {proposals[step].evidence && (
                    <p className="mt-2 text-xs leading-5 text-violet-600/80">
                      <span className="font-medium text-violet-700">Evidencia:</span> &quot;{proposals[step].evidence}&quot;
                    </p>
                  )}
                  {proposals[step].suggested_phrase && (
                    <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-violet-800">
                      <span className="font-medium">Frase sugerida:</span> {proposals[step].suggested_phrase}
                    </p>
                  )}
                </div>
                <p className="text-xs text-black/45 leading-5">
                  Esta habilidad no está explícita en tu CV, pero hay evidencia que la respalda.
                  Aprobalo solo si te sentirías cómodo defendiéndolo en una entrevista.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 rounded-full border border-black/[0.1] px-4 py-2.5 text-sm font-medium text-black/55 transition-all duration-200 hover:border-black/[0.2] hover:text-black/75 active:scale-[0.97]"
                  >
                    Omitir
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-ink/90 active:scale-[0.97]"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            )}

            {/* Summary step */}
            {isSummaryStep && (
              <div className="space-y-4 animate-fade-in-up" key="summary" style={{ animationDuration: "0.4s" }}>
                <div className="rounded-2xl bg-canvas px-4 py-3 transition-all duration-200 hover:bg-black/[0.03]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Palabras clave integradas</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {adapted.added_keywords.map((kw, i) => (
                      <span key={kw} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent animate-stagger-in" style={{ animationDelay: `${i * 30}ms` }}>
                        {kw}
                      </span>
                    ))}
                    {adapted.added_keywords.length === 0 && (
                      <span className="text-xs text-black/35">Ninguna.</span>
                    )}
                  </div>
                </div>

                {approved.length > 0 && (
                  <div className="rounded-2xl border border-green-200/60 bg-green-50/60 px-4 py-3 animate-slide-up transition-all duration-200 hover:border-green-300/70" style={{ animationDelay: "60ms" }}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-700/70">Habilidades transferibles aprobadas</p>
                    <ul className="mt-2 space-y-1.5">
                      {approved.map((a, i) => (
                        <li key={a.skill} className="text-sm animate-stagger-in" style={{ animationDelay: `${100 + i * 40}ms` }}>
                          <span className="font-medium text-green-800">{a.skill}</span>
                          <span className="ml-2 text-xs text-green-600/70">✓ Agregada al CV</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {adapted.missing_skills.length > 0 && (
                  <div className="rounded-2xl border border-red-200/60 bg-red-50/60 px-4 py-3 animate-slide-up transition-all duration-200 hover:border-red-300/70" style={{ animationDelay: "120ms" }}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700/70">Habilidades requeridas no encontradas</p>
                    <p className="mt-1 text-xs text-red-600/60">
                      No hay evidencia en tu CV. Si tenés experiencia no reflejada, agregala manualmente.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {adapted.missing_skills.map((skill, i) => (
                        <span key={skill} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 animate-stagger-in" style={{ animationDelay: `${160 + i * 30}ms` }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
                    {error}
                  </div>
                )}

                {step > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-xs font-medium text-black/45 transition-all duration-200 hover:text-black/70 active:scale-[0.97]"
                  >
                    ← Volver
                  </button>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-full border border-black/[0.1] px-4 py-2.5 text-sm font-medium text-black/55 transition-all duration-200 hover:border-black/[0.2] hover:text-black/75 active:scale-[0.97]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={finalizing}
                    className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-ink/90 active:scale-[0.97] disabled:opacity-40"
                  >
                    Generar CV adaptado
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
