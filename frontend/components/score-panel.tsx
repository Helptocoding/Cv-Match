"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import type { AdaptationImpact, MatchScoreResult } from "@/types/scoring";


function ScoreDial({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const to = value;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + eased * (to - from)));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  const pct = value / 100;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = value > 70 ? "#22c55e" : value > 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dasharray 0.05s linear" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-[26px] font-bold tracking-tight text-[#1d1d1f]">{display}</span>
        <span className="text-[11px] font-medium text-black/40">/ 100</span>
      </div>
    </div>
  );
}


const COMPAT_CONFIG = {
  alta:  { label: "Alta",  bg: "bg-emerald-500", text: "text-emerald-700",  ring: "ring-emerald-200", dot: "bg-emerald-500" },
  media: { label: "Media", bg: "bg-amber-400",   text: "text-amber-700",   ring: "ring-amber-200",   dot: "bg-amber-400"  },
  baja:  { label: "Baja",  bg: "bg-red-500",     text: "text-red-700",     ring: "ring-red-200",     dot: "bg-red-500"    },
} as const;

const SEVERITY_CONFIG = {
  bloqueante: { label: "Bloqueante", bg: "bg-red-100",    text: "text-red-700"    },
  superable:  { label: "Superable",  bg: "bg-amber-100",  text: "text-amber-700"  },
  menor:      { label: "Menor",      bg: "bg-sky-100",    text: "text-sky-700"    },
  blocker:    { label: "Bloqueante", bg: "bg-red-100",    text: "text-red-700"    },
  warning:    { label: "Advertencia",bg: "bg-amber-100",  text: "text-amber-700"  },
  info:       { label: "Informativo",bg: "bg-sky-100",    text: "text-sky-700"    },
} as const;


type Props = {
  score?: MatchScoreResult;
  adaptedScore?: MatchScoreResult;
  adaptedScoreLoading?: boolean;
  impact?: AdaptationImpact | null;
  onRetryAdaptedScore?: () => void;
};


function SkillChips({ items, tone }: { items: string[]; tone: "green" | "red" | "neutral" }) {
  const styles = {
    green:   "bg-emerald-100 text-emerald-800",
    red:     "bg-red-100 text-red-700",
    neutral: "bg-black/[0.06] text-black/55",
  }[tone];
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span
          key={s}
          className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium animate-stagger-in", styles)}
          style={{ animationDelay: `${i * 30}ms` }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}


/** Primary "did adapting help?" signal: deterministic, no LLM, reproducible. */
function ImpactPanel({ impact }: { impact: AdaptationImpact }) {
  const { skills_newly_covered, skills_still_missing, bullets_total, bullets_rewritten } = impact;
  const unchanged = Math.max(0, bullets_total - bullets_rewritten);

  return (
    <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3.5 animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/80">
        Qué cambió con la adaptación
      </p>

      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-bold leading-none tracking-tight text-emerald-700">
          {skills_newly_covered.length}
        </span>
        <span className="text-sm text-emerald-900/70">
          {skills_newly_covered.length === 1
            ? "habilidad de la vacante quedó cubierta"
            : "habilidades de la vacante quedaron cubiertas"}
        </span>
      </div>

      {skills_newly_covered.length > 0 && <SkillChips items={skills_newly_covered} tone="green" />}

      <div className="mt-3 border-t border-emerald-200/60 pt-2.5 text-xs text-emerald-900/60">
        <span className="font-medium text-emerald-900/80">{bullets_rewritten}</span> de{" "}
        <span className="font-medium text-emerald-900/80">{bullets_total}</span> bullets reescritos
        {unchanged > 0 && <span className="text-emerald-900/45"> · {unchanged} sin cambios</span>}
      </div>

      {skills_still_missing.length > 0 && (
        <div className="mt-3 border-t border-emerald-200/60 pt-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700/70">
            Siguen sin evidencia en tu CV
          </p>
          <SkillChips items={skills_still_missing} tone="red" />
        </div>
      )}
    </div>
  );
}


/** Secondary context. Two independent LLM judgements, so the pair is shown as
 *  an estimate rather than differenced into a precise-looking "+N pts". */
function ScoreEstimate({ original, adapted }: { original?: number; adapted?: number }) {
  if (original === undefined && adapted === undefined) return null;
  return (
    <div className="rounded-3xl border border-black/[0.08] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
        Compatibilidad estimada
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        {original !== undefined && (
          <>
            <span className="text-lg font-semibold text-black/45">{original}</span>
            <span className="text-black/25">→</span>
          </>
        )}
        <span className="text-lg font-semibold text-ink">{adapted ?? "—"}</span>
        <span className="text-xs text-black/35">/ 100</span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-black/40">
        Estimación aproximada del modelo, no una medición exacta: cada número viene de
        una evaluación independiente y puede variar entre corridas. Usá el detalle de
        arriba para juzgar el resultado.
      </p>
    </div>
  );
}


export function ScorePanel({ score, adaptedScore, adaptedScoreLoading, impact, onRetryAdaptedScore }: Props) {
  const compat = score ? (COMPAT_CONFIG[score.compatibility] ?? COMPAT_CONFIG.media) : null;
  const adaptedStrategy = adaptedScore?.strategy;
  const adaptedCompat = adaptedStrategy && adaptedStrategy !== "failed"
    ? (COMPAT_CONFIG[adaptedScore!.compatibility] ?? COMPAT_CONFIG.media)
    : null;
  const hadAdaptedScoreFailed = adaptedStrategy === "failed";
  const effectiveDisplay = hadAdaptedScoreFailed ? score : (adaptedScore ?? score);

  return (
    <Card>
      <div className="mb-4 flex items-center gap-4">
        {score && !adaptedScore && <ScoreDial value={score.score} />}
        {(adaptedStrategy === "llm" || adaptedStrategy === "heuristic") && adaptedScore && (
          <ScoreDial value={adaptedScore.score} />
        )}
        {adaptedScoreLoading && (
          <div className="flex shrink-0 items-center justify-center" style={{ width: 110, height: 110 }}>
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-black/[0.07] border-t-accent" />
          </div>
        )}
        <div className="min-w-0">
          {!adaptedScore && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">Compatibilidad con la vacante</p>
              {compat && (
                <div className={clsx("mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 bg-white", compat.ring)}>
                  <span className={clsx("h-1.5 w-1.5 rounded-full", compat.dot)} />
                  <span className={clsx("text-[13px] font-semibold", compat.text)}>{compat.label}</span>
                </div>
              )}
              {!score && <p className="text-[13px] font-semibold text-[#1d1d1f]">Análisis de compatibilidad</p>}
            </>
          )}
          {(adaptedStrategy === "llm" || adaptedStrategy === "heuristic") && adaptedScore && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <div className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 bg-white", adaptedCompat!.ring)}>
                <span className={clsx("h-1.5 w-1.5 rounded-full", adaptedCompat!.dot)} />
                <span className={clsx("text-[13px] font-semibold", adaptedCompat!.text)}>{adaptedCompat!.label}</span>
              </div>
            </div>
          )}
          {adaptedScoreLoading && (
            <p className="text-[13px] text-black/45">Recalculando compatibilidad…</p>
          )}
        </div>
      </div>

      {/* Deterministic impact leads: it is reproducible and, unlike the scores
          below, it still renders when the LLM re-score fails entirely. */}
      {impact && (
        <div className="mb-3 space-y-3">
          <ImpactPanel impact={impact} />
          <ScoreEstimate
            original={score?.score}
            adapted={hadAdaptedScoreFailed ? undefined : adaptedScore?.score}
          />
        </div>
      )}

      {!score && !adaptedScore && !adaptedScoreLoading ? (
        impact ? null : (
          <p className="text-sm text-black/60">Ejecutá el análisis para ver la compatibilidad semántica, brechas y habilidades transferibles.</p>
        )
      ) : hadAdaptedScoreFailed && !score ? (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-3xl border border-amber-200/70 bg-amber-50/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800/80">Recálculo de compatibilidad</p>
            <p className="mt-2 text-sm leading-6 text-amber-900/80">
              No pudimos recalcular la compatibilidad del CV adaptado. El CV adaptado está listo, pero el análisis de compatibilidad no pudo completarse.
            </p>
            {onRetryAdaptedScore && (
              <button
                type="button"
                onClick={onRetryAdaptedScore}
                className="mt-3 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 active:scale-[0.97]"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      ) : effectiveDisplay ? (
        <div className="space-y-3 animate-fade-in">
          {(() => {
            const display = effectiveDisplay!;
            return (
              <>
                <div className="rounded-3xl bg-canvas px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Resumen</p>
                  <p className="mt-2 text-sm leading-6 text-black/75">{display.summary || "—"}</p>
                  {display.strategy === "heuristic" && (
                    <p className="mt-1.5 text-xs font-medium text-amber-700">
                      Calculado sin IA: la llamada al modelo falló y se usó conteo de palabras clave como respaldo.
                    </p>
                  )}
                </div>

                {display.strengths.length > 0 && (
                  <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 animate-slide-up transition-all duration-200 hover:border-emerald-300/70 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/70">Fortalezas</p>
                    <ul className="mt-2 space-y-2">
                      {display.strengths.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-sm animate-stagger-in" style={{ animationDelay: `${i * 40}ms` }}>
                          <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                          <span>
                            <span className="font-medium text-emerald-800">{s.area}</span>
                            {s.explanation && <span className="text-emerald-700/80"> — {s.explanation}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {display.transferable_skills.length > 0 && (
                  <div
                    className="rounded-3xl border border-blue-200/60 bg-blue-50/50 px-4 py-3 animate-slide-up transition-all duration-200 hover:border-blue-300/70 hover:shadow-sm"
                    style={{ animationDelay: "55ms" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700/70">Habilidades transferibles</p>
                    <ul className="mt-2 space-y-2">
                      {display.transferable_skills.map((ts, i) => (
                        <li key={i} className="text-sm animate-stagger-in" style={{ animationDelay: `${55 + i * 40}ms` }}>
                          <span className="font-medium text-blue-800">{ts.skill}</span>
                          {ts.context && <span className="ml-2 text-blue-600/80">— {ts.context}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {display.gaps.length > 0 && (
                  <div
                    className="rounded-3xl border border-black/8 px-4 py-3 animate-slide-up transition-all duration-200 hover:border-black/[0.15] hover:shadow-sm"
                    style={{ animationDelay: "110ms" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Brechas detectadas</p>
                    <ul className="mt-2 space-y-3">
                      {display.gaps.map((gap, i) => {
                        const sev = SEVERITY_CONFIG[gap.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.superable;
                        return (
                          <li key={i} className="text-sm animate-stagger-in" style={{ animationDelay: `${110 + i * 40}ms` }}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-ink">{gap.area}</span>
                              <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", sev.bg, sev.text)}>
                                {sev.label}
                              </span>
                            </div>
                            {gap.explanation && <p className="mt-0.5 text-black/60">{gap.explanation}</p>}
                            {gap.bridge && <p className="mt-0.5 text-black/50 italic">→ {gap.bridge}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {display.recommendations.length > 0 && (
                  <div
                    className="rounded-3xl border border-black/8 bg-white px-4 py-3 animate-slide-up transition-all duration-200 hover:border-black/[0.15] hover:shadow-sm"
                    style={{ animationDelay: "165ms" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Recomendaciones</p>
                    <ul className="mt-2 space-y-1.5">
                      {display.recommendations.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-black/70 animate-stagger-in" style={{ animationDelay: `${165 + i * 40}ms` }}>
                          <span className="mt-0.5 shrink-0 text-accent">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : null}
    </Card>
  );
}
