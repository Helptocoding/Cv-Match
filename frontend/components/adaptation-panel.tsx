"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/card";
import type { AdaptedCV } from "@/types/scoring";


type View = "after" | "before" | "edit";

type Props = {
  adapted?: AdaptedCV;
  onAdaptedChange?: (updated: AdaptedCV) => void;
};

const TAB_LABELS: { id: View; label: string }[] = [
  { id: "after",  label: "Después" },
  { id: "before", label: "Antes"   },
  { id: "edit",   label: "Editar"  },
];


export function AdaptationPanel({ adapted, onAdaptedChange }: Props) {
  const [view, setView] = useState<View>("after");
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
    onAdaptedChange({
      ...adapted,
      adapted_summary: editSummary.trim(),
      adapted_experience: adapted.adapted_experience.map((exp, i) => ({
        ...exp,
        rewritten_bullets: (editBullets[i] || "")
          .split("\n")
          .map(b => b.replace(/^[•\-*]\s*/, "").trim())
          .filter(Boolean),
      })),
    });
    setView("after");
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-black/45">CV personalizado</p>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Borrador adaptado</h2>
        </div>
        {adapted && (
          <div className="flex gap-1 rounded-full bg-black/[0.04] p-0.5">
            {TAB_LABELS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
                  view === id
                    ? "bg-white text-ink shadow-sm"
                    : "text-black/50 hover:text-black/75"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!adapted ? (
        <p className="text-sm text-black/55">Adaptá el CV para ver el antes y después, comparar con la vacante y editar el resultado manualmente.</p>
      ) : view === "before" ? (
        <BeforeView adapted={adapted} sourceExpMap={sourceExpMap} />
      ) : view === "edit" ? (
        <EditView
          adapted={adapted}
          editSummary={editSummary}
          editBullets={editBullets}
          onSummaryChange={setEditSummary}
          onBulletsChange={(i, val) => setEditBullets(prev => { const next = [...prev]; next[i] = val; return next; })}
          onSave={saveEdit}
          onCancel={() => setView("after")}
        />
      ) : (
        <AfterView adapted={adapted} />
      )}
    </Card>
  );
}


function BeforeView({ adapted, sourceExpMap }: {
  adapted: AdaptedCV;
  sourceExpMap: Record<string, { bullets: string[]; title?: string; company?: string }>;
}) {
  const originalSummary = adapted.source_cv?.summary;
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="rounded-2xl bg-canvas px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Resumen original</p>
        <p className="mt-2 text-sm leading-6 text-black/65">
          {originalSummary || <span className="italic text-black/35">Sin resumen en el CV original.</span>}
        </p>
      </div>

      {adapted.adapted_experience.map((item, index) => {
        const key = `${item.company.trim().toLowerCase()}||${item.title.trim().toLowerCase()}`;
        const src = sourceExpMap[key];
        return (
          <div
            key={`${item.company}-${item.title}`}
            className="rounded-2xl border border-black/8 px-4 py-3 animate-slide-up"
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <h3 className="text-sm font-semibold text-ink">{item.title || "Rol"}</h3>
            <p className="text-xs text-black/45">{item.company}</p>
            {src?.bullets && src.bullets.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {src.bullets.map((bullet, bi) => (
                  <li key={bi} className="flex gap-2 text-sm text-black/60">
                    <span className="mt-0.5 shrink-0 text-black/25">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs italic text-black/35">Sin bullets en el CV original para esta entrada.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}


function AfterView({ adapted }: { adapted: AdaptedCV }) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="rounded-2xl bg-canvas px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Resumen adaptado</p>
        <p className="mt-2 text-sm leading-6 text-black/70">{adapted.adapted_summary || "Sin resumen generado."}</p>
      </div>

      {adapted.added_keywords.length > 0 && (
        <div className="rounded-2xl bg-canvas px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Palabras clave integradas</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {adapted.added_keywords.map((kw) => (
              <span key={kw} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {adapted.latent_skills.length > 0 && (
        <div className="rounded-2xl border border-blue-200/60 bg-blue-50/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700/70">Habilidades inferidas del CV</p>
          <p className="mt-1 text-xs text-blue-600/60">Detectadas en tu experiencia pero no listadas. Considerá agregarlas.</p>
          <ul className="mt-2 space-y-1.5">
            {adapted.latent_skills.map((ls) => (
              <li key={ls.skill} className="text-sm">
                <span className="font-medium text-blue-800">{ls.skill}</span>
                {ls.evidence && <span className="ml-2 text-xs text-blue-600/70">— &quot;{ls.evidence}&quot;</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {adapted.missing_skills.length > 0 && (
        <div className="rounded-2xl border border-red-200/60 bg-red-50/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700/70">Habilidades requeridas no encontradas</p>
          <p className="mt-1 text-xs text-red-600/60">La vacante las exige y no hay evidencia en el CV. No se pueden inventar.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {adapted.missing_skills.map((skill) => (
              <span key={skill} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-canvas px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Modo de generación</p>
        <p className="mt-1.5 text-sm text-black/60">
          {adapted.meta.strategy === "llm"
            ? `IA vía ${adapted.meta.provider || "proveedor"} ${adapted.meta.model || ""}`.trim()
            : "Extracción determinística (sin IA)"}
        </p>
      </div>

      {adapted.adapted_experience.map((item, index) => (
        <div
          key={`${item.company}-${item.title}`}
          className="rounded-2xl border border-black/8 px-4 py-3 animate-slide-up"
          style={{ animationDelay: `${index * 55}ms` }}
        >
          <h3 className="text-sm font-semibold text-ink">{item.title || "Rol"}</h3>
          <p className="text-xs text-black/45">{item.company}</p>
          {item.keywords_emphasized.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.keywords_emphasized.map((kw) => (
                <span key={kw} className="rounded-full bg-accent/8 px-2 py-0.5 text-[11px] font-medium text-accent/80">
                  {kw}
                </span>
              ))}
            </div>
          )}
          <ul className="mt-2 space-y-1.5">
            {item.rewritten_bullets.map((bullet, bi) => (
              <li key={bi} className="flex gap-2 text-sm text-black/70">
                <span className="mt-0.5 shrink-0 text-black/25">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {adapted.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {adapted.warnings.map((w, i) => (
            <p key={i} className="flex gap-2">
              <span>⚠</span>
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}
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
