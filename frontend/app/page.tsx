"use client";

import { useState } from "react";
import clsx from "clsx";
import { Upload } from "lucide-react";

import { AdaptationPanel } from "@/components/adaptation-panel";
import { LoadingPhrases }   from "@/components/loading-phrases";
import { ScorePanel }       from "@/components/score-panel";
import { Card }             from "@/components/ui/card";
import { adaptCV, exportCV, parseCV, parseJob, scoreMatch } from "@/lib/api";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "@/lib/constants";
import { useApiKey } from "@/hooks/use-api-key";
import type { AdaptedCV, MatchScoreResult } from "@/types/scoring";


/* ── shared style tokens ──────────────────────────── */
const btnPrimary = [
  "inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-semibold text-white",
  "bg-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
  "transition-all duration-200 hover:bg-[#1d1d1f]/88 hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)]",
  "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35",
].join(" ");

const btnAccent = btnPrimary.replace("bg-[#1d1d1f]", "bg-[#0071e3]")
  .replace("shadow-[0_2px_8px_rgba(0,0,0,0.18)]", "shadow-[0_2px_8px_rgba(0,113,227,0.35)]")
  .replace("hover:bg-[#1d1d1f]/88", "hover:bg-[#0077ed]")
  .replace("hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)]", "hover:shadow-[0_4px_14px_rgba(0,113,227,0.40)]");

const inputClass = [
  "w-full rounded-xl border border-black/[0.09] bg-white/70 px-3.5 py-2.5",
  "text-[14px] leading-relaxed text-[#1d1d1f] placeholder:text-black/30",
  "transition-colors duration-150 hover:border-black/[0.15] hover:bg-white/90",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 focus-visible:border-[#0071e3]/40",
].join(" ");

const FEATURES = ["Sin base de datos", "Backend stateless", "Exportación Harvard", "BYOK"];
const EXPORT_FMTS = [
  { label: "PDF",      ext: "pdf"  as const },
  { label: "DOCX",     ext: "docx" as const },
  { label: "Markdown", ext: "md"   as const },
];


export default function HomePage() {
  const { config } = useApiKey();

  const [cvText,  setCvText]  = useState("");
  const [jobText, setJobText] = useState("");
  const [file,    setFile]    = useState<File | null>(null);
  const [score,   setScore]   = useState<MatchScoreResult>();
  const [adapted, setAdapted] = useState<AdaptedCV>();
  const [busy,       setBusy]       = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [busyLabel,  setBusyLabel]  = useState("");
  const [message,    setMessage]    = useState("");

  const canRun     = Boolean(jobText.trim() && (cvText.trim() || file));
  const hasResults = Boolean(score || adapted);

  async function handleAnalyze() {
    if (!canRun) return;
    setBusy(true); setBusyLabel("Analizando compatibilidad"); setMessage("");
    try {
      const [cv, job] = await Promise.all([parseCV({ rawText: cvText, file, config }), parseJob({ rawText: jobText, config })]);
      setScore(await scoreMatch({ cv, job, config }));
      setAdapted(undefined);
      setMessage("Análisis completo.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al analizar."); }
    finally { setBusy(false); }
  }

  async function handleAdapt() {
    if (!canRun) return;
    setBusy(true); setBusyLabel("Adaptando CV a la vacante"); setMessage("");
    try {
      const [cv, job] = await Promise.all([parseCV({ rawText: cvText, file, config }), parseJob({ rawText: jobText, config })]);
      const [ar, m]   = await Promise.all([adaptCV({ cv, job, config }), scoreMatch({ cv, job, config })]);
      setAdapted(ar); setScore(m);
      setMessage("CV adaptado y analizado.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al adaptar."); }
    finally { setBusy(false); }
  }

  async function handleExport(ext: "pdf" | "docx" | "md") {
    if (!adapted || exportBusy) return;
    setExportBusy(true);
    try {
      const blob = await exportCV(adapted, ext);
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `cv-matcher.${ext}`,
      });
      a.click(); URL.revokeObjectURL(a.href);
      setMessage(`${ext.toUpperCase()} descargado.`);
    } catch { setMessage("Error al exportar."); }
    finally { setExportBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">

      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#f5f5f7]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6 md:px-8">
          <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">CV Matcher</span>
          <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-medium text-black/50">
            {DEFAULT_PROVIDER} · {DEFAULT_MODEL}
          </span>
          <div className="ml-auto hidden gap-2 sm:flex">
            {["Sin DB", "Stateless", "BYOK"].map(b => (
              <span key={b} className="rounded-full border border-black/[0.09] px-3 py-1 text-[12px] text-black/42">{b}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:px-8">

        {/* ── Hero ─────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-[2.6rem] font-bold leading-[1.06] tracking-[-0.025em] text-[#1d1d1f] md:text-[3.4rem]">
            Compará tu CV contra<br className="hidden md:block" /> cualquier vacante.
          </h1>
          <p className="mt-4 max-w-[520px] text-[16px] leading-[1.6] text-black/55">
            Análisis semántico, adaptación inteligente y exportación en formato Harvard — sin guardar tus datos en el servidor.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {FEATURES.map(f => (
              <span key={f} className="rounded-full border border-black/[0.1] px-3.5 py-1.5 text-[13px] font-medium text-black/50">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ── Inputs ───────────────────────────────────── */}
        <div className="mb-5 grid gap-4 lg:grid-cols-2">

          {/* CV Card */}
          <Card>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.05]">
                <Upload size={15} className="text-black/50" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">Tu CV</p>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">Currículum</p>
              </div>
            </div>
            <label className={clsx(
              "mb-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed px-4 py-3 text-[13px] transition-colors duration-150",
              file
                ? "border-[#0071e3]/30 bg-[#0071e3]/[0.04] text-[#0071e3]"
                : "border-black/[0.1] bg-black/[0.02] text-black/40 hover:border-black/[0.18] hover:bg-black/[0.04]"
            )}>
              <Upload size={13} />
              <span className="truncate">{file ? file.name : "Subir PDF, DOCX o TXT"}</span>
              <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <textarea
              value={cvText}
              onChange={e => setCvText(e.target.value)}
              placeholder="O pegá el texto del CV acá…"
              rows={9}
              className={clsx(inputClass, "resize-none")}
            />
          </Card>

          {/* Job Card */}
          <Card>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0071e3]/[0.08]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">Vacante</p>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">Descripción del puesto</p>
              </div>
            </div>
            <textarea
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              placeholder="Pegá la descripción completa de la vacante acá…"
              rows={12}
              className={clsx(inputClass, "resize-none")}
            />
          </Card>
        </div>

        {/* ── Action row ───────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!canRun || busy} onClick={handleAnalyze} className={btnPrimary}>
            Analizar compatibilidad
          </button>
          <button type="button" disabled={!canRun || busy} onClick={handleAdapt} className={btnAccent}>
            Adaptar CV
          </button>

          {busy && (
            <span className="flex items-center gap-2 text-[13px] text-black/45">
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              {busyLabel}…
            </span>
          )}
          {!busy && message && (
            <span className={clsx("text-[13px]", message.toLowerCase().includes("error") ? "text-red-500" : "text-black/45")}>
              {message}
            </span>
          )}

          {adapted && !busy && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[12px] text-black/35">Exportar:</span>
              {EXPORT_FMTS.map(({ label, ext }) => (
                <button
                  key={ext}
                  type="button"
                  disabled={exportBusy}
                  onClick={() => handleExport(ext)}
                  className="rounded-full border border-black/[0.12] bg-white/70 px-4 py-1.5 text-[13px] font-medium text-black/55 backdrop-blur-sm transition-all duration-150 hover:border-black/[0.2] hover:bg-white active:scale-[0.97] disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Results ──────────────────────────────────── */}
        {busy ? (
          <Card className="py-4">
            <LoadingPhrases label={busyLabel} />
          </Card>
        ) : hasResults ? (
          <div className="grid gap-4 animate-fade-in lg:grid-cols-2">
            {score
              ? <ScorePanel score={score} />
              : <Card className="flex items-center justify-center py-16 text-[13px] text-black/38">
                  Ejecutá el análisis para ver la compatibilidad.
                </Card>
            }
            {adapted
              ? <AdaptationPanel adapted={adapted} onAdaptedChange={setAdapted} />
              : <Card className="flex items-center justify-center py-16 text-[13px] text-black/38">
                  Usá "Adaptar CV" para ver el borrador.
                </Card>
            }
          </div>
        ) : null}

      </div>
    </div>
  );
}
