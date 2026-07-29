"use client";

import { useMemo, useState } from "react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { Card } from "@/components/ui/card";
import type { AdaptedCV } from "@/types/scoring";
import { matchBullets, wordDiff } from "@/lib/diff-cv";
import type { DiffToken } from "@/lib/diff-cv";
import { formatAdaptationWarnings } from "@/lib/ui-warnings";


type View = "changes" | "edit";

type Props = {
  adapted?: AdaptedCV;
  onAdaptedChange?: (updated: AdaptedCV) => void;
};

const TAB_LABELS: { id: View; label: string }[] = [
  { id: "changes", label: "Cambios" },
  { id: "edit",    label: "Editar"  },
];


export function AdaptationPanel({ adapted, onAdaptedChange }: Props) {
  const [view, setView] = useState<View>("changes");
  const [editSummary, setEditSummary] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);

  const sourceExpMap = useMemo(() => {
    if (!adapted?.source_cv) return {};
    return Object.fromEntries(
      adapted.source_cv.experience.map(exp => [
        `${exp.company.trim().toLowerCase()}||${exp.title.trim().toLowerCase()}`,
        exp,
      ])
    );
  }, [adapted?.source_cv]);

  function handleTabChange(next: View) {
    if (next === "edit" && adapted) {
      setEditSummary(adapted.adapted_summary);
      setEditBullets(adapted.adapted_experience.map(e => e.rewritten_bullets.join("\n")));
    }
    setView(next);
  }

  function saveEdit() {
    if (!adapted || !onAdaptedChange) return;
    const nextBullets = adapted.adapted_experience.map((_, i) => (
      (editBullets[i] || "")
        .split("\n")
        .map(b => b.replace(/^[•\-*]\s*/, "").trim())
        .filter(Boolean)
    ));

    onAdaptedChange({
      ...adapted,
      adapted_summary: editSummary.trim(),
      adapted_experience: adapted.adapted_experience.map((exp, i) => ({
        ...exp,
        rewritten_bullets: nextBullets[i],
        bullet_was_rewritten: nextBullets[i].map(() => true),
      })),
    });
    setView("changes");
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-black/45">CV personalizado</p>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Borrador adaptado</h2>
        </div>
        {adapted && (
          <AnimatedTabs
            tabs={TAB_LABELS}
            activeTab={view}
            onChange={(id) => handleTabChange(id as "changes" | "edit")}
          />
        )}
      </div>

      {!adapted ? (
        <p className="text-sm text-black/55">Adaptá el CV para ver los cambios y editar el resultado manualmente.</p>
      ) : view === "changes" ? (
        <ChangesView adapted={adapted} sourceExpMap={sourceExpMap} />
      ) : (
        <EditView
          adapted={adapted}
          editSummary={editSummary}
          editBullets={editBullets}
          onSummaryChange={setEditSummary}
          onBulletsChange={(i, val) => setEditBullets(prev => { const next = [...prev]; next[i] = val; return next; })}
          onSave={saveEdit}
          onCancel={() => setView("changes")}
        />
      )}
    </Card>
  );
}


function DiffSpans({ tokens }: { tokens: DiffToken[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        if (t.added) {
          return <span key={i} className="bg-green-200/70 rounded px-0.5">{t.value}</span>;
        }
        if (t.removed) {
          return <span key={i} className="bg-red-200/70 rounded px-0.5 line-through">{t.value}</span>;
        }
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}

function RewriteBadge({ wasRewritten }: { wasRewritten: boolean }) {
  if (wasRewritten) return null;
  return (
    <span className="shrink-0 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/35">
      sin cambios
    </span>
  );
}

function hasVisibleDiffChange(tokens: DiffToken[]): boolean {
  return tokens.some((token) => token.added || token.removed);
}


function ChangesView({ adapted, sourceExpMap }: {
  adapted: AdaptedCV;
  sourceExpMap: Record<string, { bullets: string[]; title?: string; company?: string }>;
}) {
  const originalSummary = adapted.source_cv?.summary || "";
  const panelWarnings = formatAdaptationWarnings(adapted.meta.warnings || []);

  return (
    <div className="space-y-3 animate-fade-in">
      {panelWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800/80">Revision sugerida</p>
          <div className="mt-2 space-y-1.5">
            {panelWarnings.map((warning) => (
              <p key={warning} className="text-xs leading-5 text-amber-900/80">{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-canvas px-4 py-3 transition-all duration-200 hover:bg-black/[0.03]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Resumen</p>
        <p className="mt-2 text-sm leading-6 text-black/70">
          {originalSummary || adapted.adapted_summary ? (
            <DiffSpans tokens={wordDiff(originalSummary, adapted.adapted_summary)} />
          ) : (
            <span className="italic text-black/35">Sin resumen.</span>
          )}
        </p>
      </div>

      {adapted.adapted_experience.map((item, index) => {
        const key = `${item.company.trim().toLowerCase()}||${item.title.trim().toLowerCase()}`;
        const src = sourceExpMap[key];
        const originalBullets = src?.bullets || [];
        const matches = matchBullets(originalBullets, item.rewritten_bullets);

        return (
          <div
            key={`${item.company}-${item.title}`}
            className="rounded-2xl border border-black/8 px-4 py-3 animate-stagger-in transition-all duration-200 hover:border-black/[0.15] hover:shadow-sm"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <h3 className="text-sm font-semibold text-ink">{item.title || "Rol"}</h3>
            <p className="text-xs text-black/45">{item.company}</p>
              {matches.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {matches.map((m, mi) => {
                  if (m.kind === "paired") {
                    const tokens = wordDiff(m.pair.original, m.pair.adapted);
                    const wasRewritten = hasVisibleDiffChange(tokens);
                    return (
                      <li key={mi} className="flex gap-2 text-sm text-black/70 animate-stagger-in" style={{ animationDelay: `${mi * 30}ms`, animationDuration: "0.3s" }}>
                        <span className="mt-0.5 shrink-0 text-black/25">•</span>
                        <span className="min-w-0 flex-1 break-words leading-6">
                          <DiffSpans tokens={tokens} />
                        </span>
                        <RewriteBadge wasRewritten={wasRewritten} />
                      </li>
                    );
                  }
                  if (m.kind === "new") {
                    return (
                      <li key={mi} className="flex gap-2 text-sm animate-stagger-in" style={{ animationDelay: `${mi * 30}ms`, animationDuration: "0.3s" }}>
                        <span className="mt-0.5 shrink-0 text-green-600">•</span>
                        <span className="min-w-0 flex-1 break-words rounded bg-green-200/70 px-0.5 leading-6">{m.adapted}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={mi} className="flex gap-2 text-sm animate-stagger-in" style={{ animationDelay: `${mi * 30}ms`, animationDuration: "0.3s" }}>
                      <span className="mt-0.5 shrink-0 text-red-400">•</span>
                      <span className="min-w-0 flex-1 break-words rounded bg-red-200/70 px-0.5 leading-6 line-through text-black/50">{m.original}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs italic text-black/35">Sin cambios en esta entrada.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}


function EditView({ adapted, editSummary, editBullets, onSummaryChange, onBulletsChange, onSave, onCancel }: {
  adapted: AdaptedCV;
  editSummary: string;
  editBullets: string[];
  onSummaryChange: (val: string) => void;
  onBulletsChange: (i: number, val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/40 mb-1.5">
          Resumen profesional
        </label>
        <textarea
          value={editSummary}
          onChange={e => onSummaryChange(e.target.value)}
          className="w-full rounded-2xl border border-black/12 bg-canvas px-3 py-2.5 text-sm text-black/80 min-h-[90px]"
          placeholder="Resumen profesional adaptado…"
        />
      </div>

      {adapted.adapted_experience.map((exp, i) => (
        <div key={`${exp.company}-${exp.title}`}>
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/40 mb-1.5">
            {exp.title} — {exp.company}
          </label>
          <textarea
            value={editBullets[i] || ""}
            onChange={e => onBulletsChange(i, e.target.value)}
            className="w-full rounded-2xl border border-black/12 bg-canvas px-3 py-2.5 text-sm text-black/80 min-h-[110px]"
            placeholder="Un bullet por línea…"
          />
          <p className="mt-1 text-[11px] text-black/35">Un bullet por línea. No hace falta usar •</p>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.98]"
        >
          Guardar cambios
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-black/[0.05] px-4 py-2 text-sm font-medium text-black/60 transition-all duration-150 hover:bg-black/[0.08]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
