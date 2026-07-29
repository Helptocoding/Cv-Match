"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { Upload, FileText, Trash2, Github } from "lucide-react";

import { AdaptationPanel } from "@/components/adaptation-panel";
import { AdaptationWizard } from "@/components/adaptation-wizard";
import { CoverLetterPanel } from "@/components/cover-letter-panel";
import { CvPreviewPanel } from "@/components/cv-preview-panel";
import { FallbackBanner } from "@/components/fallback-banner";
import { ThinkingOrb } from "thinking-orbs";
import { LoadingPhrases }   from "@/components/loading-phrases";
import { ScorePanel }       from "@/components/score-panel";
import { Card }             from "@/components/ui/card";
import { adaptCV, exportCV, generateCoverLetter, parseCV, parseJob, scoreAdapted, scoreMatch } from "@/lib/api";
import { useApiKey } from "@/hooks/use-api-key";
import { collectDegradations } from "@/lib/degradation";
import { clearCvData, loadCvText, loadFileName, loadParsedCv, saveCvText, saveFileName, saveParsedCv } from "@/lib/storage";
import { ProviderConfigPanel } from "@/components/provider-config";
import type { ProviderConfig } from "@/types/api";
import type { StructuredCV } from "@/types/cv";
import type { StructuredJob } from "@/types/job";
import type { AdaptedCV, MatchScoreResult } from "@/types/scoring";
import type { CoverLetterResult } from "@/types/cover-letter";


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
  const { config, updateConfig, isConfigured, hydrated: configHydrated } = useApiKey();
  const [showProviderConfig, setShowProviderConfig] = useState(false);

  const [cvText,  setCvText]  = useState("");
  const [jobText, setJobText] = useState("");
  const [file,    setFile]    = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [parsedCV, setParsedCV] = useState<StructuredCV | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [parsedJob, setParsedJob] = useState<StructuredJob | null>(null);
  const [score,   setScore]   = useState<MatchScoreResult>();
  const [adaptedScore, setAdaptedScore] = useState<MatchScoreResult>();
  const [adaptedScoreLoading, setAdaptedScoreLoading] = useState(false);
  const [adapted, setAdapted] = useState<AdaptedCV>();
  const [coverLetterResult, setCoverLetterResult] = useState<CoverLetterResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [busyLabel,  setBusyLabel]  = useState("");
  const [message,    setMessage]    = useState("");
  const [adaptMode,  setAdaptMode]  = useState<"fast" | "deep">("fast");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardData, setWizardData] = useState<{ adapted: AdaptedCV; cv: StructuredCV; job: StructuredJob } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Editing the CV or the vacancy invalidates the parse AND every score derived
  // from it. Clearing the scores together is what keeps the before/after pair
  // honest: otherwise a baseline computed against the previous vacancy stays on
  // screen next to an adapted score computed against the new one.
  // The adapted draft itself is kept — it is user work, and losing it on a
  // keystroke would be worse than showing it without a comparison.
  function invalidateDerivedScores() {
    setScore(undefined);
    setAdaptedScore(undefined);
  }

  const canRun     = Boolean(jobText.trim() && (cvText.trim() || file));
  const canAnalyze = canRun && isConfigured;
  const hasResults = Boolean(score || adapted);
  // Recomputed on render: every one of these can be replaced independently
  // (re-score, re-adapt), so a memo keyed on all five buys nothing.
  const degradations = collectDegradations({
    cv: parsedCV, job: parsedJob, score, adapted, adaptedScore,
  });

  useEffect(() => {
    setCvText(loadCvText() ?? "");
    setFileName(loadFileName());
    setParsedCV(loadParsedCv());
    setSaved(!!(loadCvText() || loadParsedCv() || loadFileName()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const anyModalOpen = showWizard || coverLetterResult !== null || showPreview;
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showWizard, coverLetterResult, showPreview]);

  async function handleAnalyze() {
    if (!canAnalyze) {
      if (!isConfigured) { setMessage("Configurá una API key desde el botón en el header antes de analizar."); }
      return;
    }
    setBusy(true); setBusyLabel("Analizando compatibilidad"); setMessage("");
    scrollToResults();
    try {
      // Reuse cached parses — both are invalidated whenever their source text
      // or file changes, so a hit here always matches what is on screen.
      const [cv, job] = await Promise.all([
        parsedCV ?? parseCV({ rawText: cvText, file, config }),
        parsedJob ?? parseJob({ rawText: jobText, config }),
      ]);
      setParsedCV(cv); saveParsedCv(cv); setParsedJob(job);
      setScore(await scoreMatch({ cv, job, config }));
      setAdapted(undefined);
      setAdaptedScore(undefined);
      setMessage("Análisis completo.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al analizar."); }
    finally { setBusy(false); }
  }

  async function handleAdapt() {
    if (!canAnalyze) {
      if (!isConfigured) { setMessage("Configurá una API key desde el botón en el header antes de adaptar."); }
      return;
    }
    setBusy(true); setBusyLabel("Adaptando CV a la vacante"); setMessage("");
    setAdaptedScore(undefined);
    scrollToResults();
    try {
      // parseCV and parseJob are independent — resolve them together.
      const [cv, job] = await Promise.all([
        parsedCV ?? parseCV({ rawText: cvText, file, config }),
        parsedJob ?? parseJob({ rawText: jobText, config }),
      ]);
      setParsedCV(cv); saveParsedCv(cv); setParsedJob(job);
      // The baseline score and the adaptation both depend only on (cv, job),
      // not on each other, so they run concurrently instead of back-to-back.
      const [, ar] = await Promise.all([
        score
          ? Promise.resolve(undefined)
          : scoreMatch({ cv, job, config }).then(setScore).catch(() => undefined),
        adaptCV({ cv, job, config, mode: adaptMode }),
      ]);
      if (adaptMode === "deep" && ar.latent_proposals && ar.latent_proposals.length > 0) {
        setWizardData({ adapted: ar, cv, job });
        setShowWizard(true);
        setBusy(false);
      } else {
        setAdapted(ar);
        setMessage("CV adaptado.");
        setBusy(false);
        // re-score in background — non-blocking
        setAdaptedScoreLoading(true);
        try {
          const as = await scoreAdapted({ adapted: ar, job, config });
          setAdaptedScore(as);
        } catch {
          setAdaptedScore({
            score: 0, compatibility: "baja", summary: "",
            strengths: [], gaps: [], transferable_skills: [], recommendations: [],
            strategy: "failed",
          });
        } finally {
          setAdaptedScoreLoading(false);
        }
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al adaptar."); setBusy(false); }
  }

  async function handleGenerateCoverLetter() {
    if (!canAnalyze) {
      if (!isConfigured) { setMessage("Configurá una API key desde el botón en el header antes de generar la carta."); }
      return;
    }
    setBusy(true); setBusyLabel("Generando carta de presentación"); setMessage("");
    scrollToResults();
    try {
      let cv = parsedCV;
      let job = parsedJob;
      if (!cv || !job) {
        const results = await Promise.all([parseCV({ rawText: cvText, file, config }), parseJob({ rawText: jobText, config })]);
        cv = results[0]; job = results[1];
        setParsedCV(cv); saveParsedCv(cv); setParsedJob(job);
      }
      const result = await generateCoverLetter({ cv, job, config });
      setCoverLetterResult(result);
      setMessage("Carta de presentación generada.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al generar la carta."); }
    finally { setBusy(false); }
  }

  async function handleWizardComplete(finalized: AdaptedCV) {
    setAdapted(finalized);
    setShowWizard(false);
    setWizardData(null);
    setMessage("CV adaptado finalizado.");
    // re-score in background
    if (parsedJob) {
      setAdaptedScoreLoading(true);
      try {
        const as = await scoreAdapted({ adapted: finalized, job: parsedJob, config });
        setAdaptedScore(as);
      } catch {
        setAdaptedScore({
          score: 0, compatibility: "baja", summary: "",
          strengths: [], gaps: [], transferable_skills: [], recommendations: [],
          strategy: "failed",
        });
      } finally {
        setAdaptedScoreLoading(false);
      }
    }
  }

  const handleRetryAdaptedScore = useCallback(() => {
    if (!adapted || !parsedJob) return;
    setAdaptedScoreLoading(true);
    scoreAdapted({ adapted, job: parsedJob, config })
      .then(setAdaptedScore)
      .catch(() => {
        setAdaptedScore({
          score: 0, compatibility: "baja", summary: "",
          strengths: [], gaps: [], transferable_skills: [], recommendations: [],
          strategy: "failed",
        });
      })
      .finally(() => setAdaptedScoreLoading(false));
  }, [adapted, parsedJob, config]);

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

  function persistCv() {
    const textToSave = cvText || parsedCV?.raw_text || "";
    saveCvText(textToSave);
    if (textToSave && !cvText) setCvText(textToSave);
    if (fileName) saveFileName(fileName);
    if (parsedCV) saveParsedCv(parsedCV);
    setSaved(true);
  }

  function handleClearCv() {
    clearCvData();
    setCvText("");
    setParsedCV(null);
    setAdapted(undefined);
    setScore(undefined);
    setAdaptedScore(undefined);
    setFile(null);
    setFileName(null);
    setSaved(false);
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] relative">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e2e8f0 1px, transparent 1px),
            linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
          `,
          backgroundSize: "20px 30px",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 100%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 100%, #000 60%, transparent 100%)",
        }}
      />
      <div className="relative z-10">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#f8fafc]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6 md:px-8">
          <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">CV Matcher</span>
          {configHydrated && (
            <button
              type="button"
              onClick={() => setShowProviderConfig(true)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.97] ${
                isConfigured
                  ? "bg-black/[0.06] text-black/50 hover:bg-black/[0.1] hover:text-black/70"
                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
              title="Cambiar proveedor o API key"
            >
              {isConfigured ? `${config.provider} · ${config.model}` : "Configurar API key"}
            </button>
          )}
          <div className="ml-auto hidden gap-2 sm:flex">
            {["Sin DB", "Stateless", "BYOK"].map(b => (
              <span key={b} className="rounded-full border border-black/[0.09] px-3 py-1 text-[12px] text-black/42">{b}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:px-8">

        <div className="mb-10 animate-fade-in-up" style={{ animationDuration: "0.6s" }}>
          <h1 className="text-[2.6rem] font-bold leading-[1.06] tracking-[-0.025em] text-[#1d1d1f] md:text-[3.4rem] animate-fade-in-up"
               style={{ animationDelay: "0ms", animationDuration: "0.6s" }}>
            Compara tu CV contra<br className="hidden md:block" /> cualquier vacante.
          </h1>
          <p className="mt-4 max-w-[520px] text-[16px] leading-[1.6] text-black/55 animate-fade-in-up"
             style={{ animationDelay: "120ms", animationDuration: "0.5s" }}>
            Análisis semántico, adaptación inteligente y exportación en formato Harvard — sin guardar tus datos en el servidor.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 animate-fade-in-up" style={{ animationDelay: "240ms", animationDuration: "0.5s" }}>
            {FEATURES.map(f => (
              <span key={f} className="rounded-full border border-black/[0.1] px-3.5 py-1.5 text-[13px] font-medium text-black/50 transition-all duration-200 hover:border-black/25 hover:text-black/70 hover:bg-black/[0.02] active:scale-[0.97]">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-4 lg:grid-cols-2 animate-fade-in-up" style={{ animationDelay: "360ms", animationDuration: "0.5s" }}>

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
              <span className="truncate">{fileName || file?.name || "Subir PDF, DOCX o TXT"}</span>
              <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setParsedCV(null);
                invalidateDerivedScores();
                if (f) {
                  setFileName(f.name);
                  if (f.name.endsWith(".txt")) {
                    const reader = new FileReader();
                    reader.onload = () => setCvText(reader.result as string);
                    reader.readAsText(f);
                  }
                }
              }} />
            </label>
            <textarea
              value={cvText}
              onChange={e => { setCvText(e.target.value); setParsedCV(null); invalidateDerivedScores(); }}
              placeholder="O pegá el texto del CV acá…"
              rows={9}
              className={clsx(inputClass, "resize-none")}
            />
            {(cvText || parsedCV || file || fileName) && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {saved ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-300/60 bg-green-50 px-3 py-1.5 text-[12px] font-medium text-green-700">
                        Guardado ✓
                      </span>
                      <button
                        type="button"
                        onClick={handleClearCv}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] px-3 py-1.5 text-[12px] font-medium text-black/45 transition-all duration-150 hover:border-red-300 hover:text-red-500 active:scale-[0.97]"
                      >
                        <Trash2 size={12} />
                        Limpiar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={persistCv}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] px-3 py-1.5 text-[12px] font-medium text-black/55 transition-all duration-150 hover:border-black/[0.2] hover:text-black/75 active:scale-[0.97]"
                    >
                      Guardar CV
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-black/35">Se guarda solo en este navegador.</span>
              </div>
            )}
          </Card>

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
              onChange={e => { setJobText(e.target.value); setParsedJob(null); invalidateDerivedScores(); }}
              placeholder="Pegá la descripción completa de la vacante acá…"
              rows={12}
              className={clsx(inputClass, "resize-none")}
            />
          </Card>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3 animate-fade-in-up" style={{ animationDelay: "480ms", animationDuration: "0.5s" }}>
          <button type="button" disabled={!canAnalyze || busy} onClick={handleAnalyze} className={btnPrimary}>
            Analizar compatibilidad
          </button>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-full bg-black/[0.04] p-0.5 transition-all duration-200 hover:bg-black/[0.06]">
              <button
                type="button"
                onClick={() => setAdaptMode("fast")}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  adaptMode === "fast" ? "bg-white text-ink shadow-sm" : "text-black/50 hover:text-black/75"
                )}
              >
                Rápido
              </button>
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => setAdaptMode("deep")}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    adaptMode === "deep" ? "bg-white text-ink shadow-sm" : "text-black/50 hover:text-black/75"
                  )}
                >
                  Profundo
                </button>
                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-[240px] -translate-x-1/2 rounded-xl border border-black/[0.08] bg-white/95 px-3 py-2 text-[11px] leading-5 text-black/60 opacity-0 shadow-lg shadow-black/[0.06] transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                  ~3 llamadas al LLM · El recálculo de compatibilidad suma ~1 llamada extra
                </div>
              </div>
            </div>
          </div>
          <button type="button" disabled={!canAnalyze || busy} onClick={handleAdapt} className={btnAccent}>
            {adaptMode === "deep" ? "Adaptar CV (profundo)" : "Adaptar CV"}
          </button>
          {adaptMode === "deep" && (
            <p className="text-[11px] text-amber-700/60 max-w-[220px]">
              
            </p>
          )}
          <button type="button" disabled={!canAnalyze || busy} onClick={handleGenerateCoverLetter} className={btnPrimary}>
            <FileText size={14} />
            Carta de presentación
          </button>

          {busy && (
            <span className="flex items-center gap-2 text-[13px] text-black/45">
              <ThinkingOrb state="working" size={20} />
              {busyLabel}…
            </span>
          )}
          {!busy && message && (
            <span className={clsx("text-[13px]", message.toLowerCase().includes("error") ? "text-red-500" : "text-black/45")}>
              {message}
            </span>
          )}

          {adapted && !busy && (
            <div className="ml-auto flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: "200ms", animationDuration: "0.4s" }}>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="rounded-full border border-black/[0.12] bg-white/70 px-4 py-1.5 text-[13px] font-medium text-black/55 backdrop-blur-sm transition-all duration-200 hover:border-black/[0.25] hover:bg-white hover:text-black/75 hover:shadow-sm active:scale-[0.97]"
              >
                Vista previa
              </button>
              <span className="text-[12px] text-black/35">Exportar:</span>
              {EXPORT_FMTS.map(({ label, ext }) => (
                <button
                  key={ext}
                  type="button"
                  disabled={exportBusy}
                  onClick={() => handleExport(ext)}
                  className="rounded-full border border-black/[0.12] bg-white/70 px-4 py-1.5 text-[13px] font-medium text-black/55 backdrop-blur-sm transition-all duration-200 hover:border-black/[0.25] hover:bg-white hover:text-black/75 hover:shadow-sm active:scale-[0.97] disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={resultsRef}>
          {busy ? (
            <Card className="animate-scale-in-bounce py-4">
              <LoadingPhrases label={busyLabel} />
            </Card>
          ) : hasResults ? (
            <div className="space-y-4">
            <FallbackBanner steps={degradations} onOpenProviderConfig={() => setShowProviderConfig(true)} />
            <div className="grid gap-4 animate-fade-in-up lg:grid-cols-2" style={{ animationDuration: "0.5s" }}>
              {score || adaptedScore || adaptedScoreLoading || adapted?.impact
                ? <ScorePanel score={score} adaptedScore={adaptedScore} adaptedScoreLoading={adaptedScoreLoading} impact={adapted?.impact} onRetryAdaptedScore={handleRetryAdaptedScore} />
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
            </div>
          ) : null}
        </div>

      </div>

      <footer className="mt-12 border-t border-black/[0.06] bg-white/50 py-6 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-[12px] text-black/40 sm:flex-row md:px-8">
          <a
            href="https://github.com/Helptocoding/Cv-Match"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1.5 text-black/55 transition-all duration-200 hover:border-black/[0.14] hover:bg-white hover:text-black/75"
          >
            <Github size={14} />
            <span>Ver en GitHub</span>
          </a>
        </div>
      </footer>

      {coverLetterResult && (
        <CoverLetterPanel result={coverLetterResult} onClose={() => setCoverLetterResult(null)} />
      )}

      {showPreview && adapted && (
        <CvPreviewPanel
          adapted={adapted}
          onClose={() => setShowPreview(false)}
          onStatus={setMessage}
        />
      )}

      {showWizard && wizardData && !busy && (
        <AdaptationWizard
          adapted={wizardData.adapted}
          cv={wizardData.cv}
          job={wizardData.job}
          config={config}
          onComplete={handleWizardComplete}
          onCancel={() => { setShowWizard(false); setWizardData(null); }}
        />
      )}

      {showProviderConfig && (
        <ProviderConfigPanel
          config={config}
          onSave={updateConfig}
          onClose={() => setShowProviderConfig(false)}
        />
      )}

      </div>{/* end relative z-10 */}
    </div>
  );
}
