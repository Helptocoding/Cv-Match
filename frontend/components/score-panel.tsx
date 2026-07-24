"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import type { MatchScoreResult } from "@/types/scoring";


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
  const color = value >= 65 ? "#22c55e" : value >= 45 ? "#f59e0b" : "#ef4444";

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
} as const;


type Props = {
  score?: MatchScoreResult;
};


export function ScorePanel({ score }: Props) {
  const compat = score ? (COMPAT_CONFIG[score.compatibility] ?? COMPAT_CONFIG.media) : null;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-4">
        {score && <ScoreDial value={score.score} />}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">Compatibilidad con la vacante</p>
          {compat && (
            <div className={clsx("mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1", compat.ring, "bg-white")}>
              <span className={clsx("h-1.5 w-1.5 rounded-full", compat.dot)} />
              <span className={clsx("text-[13px] font-semibold", compat.text)}>{compat.label}</span>
            </div>
          )}
          {!score && <p className="text-[13px] font-semibold text-[#1d1d1f]">Análisis de compatibilidad</p>}
        </div>
      </div>

      {!score ? (
        <p className="text-sm text-black/60">Ejecutá el análisis para ver la compatibilidad semántica, brechas y habilidades transferibles.</p>
      ) : (
        <div className="space-y-3 animate-fade-in">

          <div className="rounded-3xl bg-canvas px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Resumen</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{score.summary || "—"}</p>
            {score.strategy === "heuristic" && (
              <p className="mt-1.5 text-xs text-black/40">Análisis heurístico — configurá un proveedor de IA para análisis semántico completo.</p>
            )}
          </div>

          {score.strengths.length > 0 && (
            <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 animate-slide-up">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/70">Fortalezas</p>
              <ul className="mt-2 space-y-2">
                {score.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
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

          {score.transferable_skills.length > 0 && (
            <div
              className="rounded-3xl border border-blue-200/60 bg-blue-50/50 px-4 py-3 animate-slide-up"
              style={{ animationDelay: "55ms" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700/70">Habilidades transferibles</p>
              <ul className="mt-2 space-y-2">
                {score.transferable_skills.map((ts, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-blue-800">{ts.skill}</span>
                    {ts.context && <span className="ml-2 text-blue-600/80">— {ts.context}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {score.gaps.length > 0 && (
            <div
              className="rounded-3xl border border-black/8 px-4 py-3 animate-slide-up"
              style={{ animationDelay: "110ms" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Brechas detectadas</p>
              <ul className="mt-2 space-y-3">
                {score.gaps.map((gap, i) => {
                  const sev = SEVERITY_CONFIG[gap.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.superable;
                  return (
                    <li key={i} className="text-sm">
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

          {score.recommendations.length > 0 && (
            <div
              className="rounded-3xl border border-black/8 bg-white px-4 py-3 animate-slide-up"
              style={{ animationDelay: "165ms" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Recomendaciones</p>
              <ul className="mt-2 space-y-1.5">
                {score.recommendations.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-black/70">
                    <span className="mt-0.5 shrink-0 text-accent">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </Card>
  );
}
