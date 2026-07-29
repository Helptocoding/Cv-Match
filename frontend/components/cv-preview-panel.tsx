"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

import { exportPdf, fetchPreviewHtml } from "@/lib/api";
import type { AdaptedCV } from "@/types/scoring";


const FONTS = [
  { key: "serif",    label: "Serif",      description: "Liberation Serif — clásico (Times New Roman)" },
  { key: "garamond", label: "Garamond",   description: "EB Garamond — serif elegante" },
  { key: "noto",     label: "Noto Serif", description: "Noto Serif — moderno y legible" },
  { key: "carlito",  label: "Carlito",    description: "Carlito — sans-serif (Calibri)" },
] as const;

const STORAGE_KEY = "cv-matcher-font-preference";


function getInitialFont(): string {
  if (typeof window === "undefined") return "serif";
  return localStorage.getItem(STORAGE_KEY) ?? "serif";
}

function saveFontPreference(key: string) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
}


type Props = {
  adapted: AdaptedCV;
  onClose: () => void;
  onStatus: (msg: string) => void;
};


export function CvPreviewPanel({ adapted, onClose, onStatus }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingFontRef = useRef<string | null>(null);
  const [font, setFont] = useState(getInitialFont);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pendingFontRef.current = null;
    fetchPreviewHtml(adapted)
      .then((h) => { if (!cancelled) { setHtml(h); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message ?? "Error al cargar vista previa"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [adapted]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    iframe.srcdoc = html;
  }, [html]);

  function applyFontToIframe(key: string) {
    const iframe = iframeRef.current;
    if (!iframe) return false;
    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (doc?.body) {
        doc.body.className = `font-${key}`;
        return true;
      }
    } catch { /* cross-origin guard */ }
    return false;
  }

  function applyFont(key: string) {
    setFont(key);
    saveFontPreference(key);
    if (!applyFontToIframe(key)) {
      pendingFontRef.current = key;
    }
  }

  function handleIframeLoad() {
    const key = pendingFontRef.current ?? font;
    pendingFontRef.current = null;
    applyFontToIframe(key);
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const blob = await exportPdf({ adapted, font });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "cv-matcher-harvard.pdf",
      });
      a.click();
      URL.revokeObjectURL(a.href);
      onStatus("PDF descargado.");
      onClose();
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Error al exportar PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-[740px] h-[90vh] flex flex-col rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden animate-scale-in-bounce">

        {/* Header — single row */}
        <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-black/[0.06] bg-white animate-fade-in-up" style={{ animationDuration: "0.35s" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">Vista previa</span>
          <div className="flex items-center gap-1.5">
            {FONTS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => applyFont(f.key)}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
                  font === f.key
                    ? "bg-[#1d1d1f] text-white shadow-sm"
                    : "border border-black/[0.1] bg-white/70 text-black/55 hover:border-black/[0.2] hover:bg-white"
                )}
                title={f.description}
              >
                {f.label}
              </button>
            ))}
            <div className="w-px h-4 bg-black/[0.08] mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/[0.05] transition-colors"
            >
              <X size={13} className="text-black/40" />
            </button>
          </div>
        </div>

        {/* Body — gray desk area, paper sits here */}
        <div className="flex-1 min-h-0 bg-[#e5e5e5] flex items-start justify-center overflow-y-auto px-6 py-6">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <ThinkingOrb state="working" size={64} />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-24">
              <p className="text-[13px] text-red-500">{error}</p>
            </div>
          )}
          {!loading && !error && html && (
            <div
              className="bg-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] shrink-0 rounded-sm"
              style={{ zoom: 0.75, width: 816, height: 1056 }}
            >
              <iframe
                ref={iframeRef}
                title="CV Preview"
                width={816}
                height={1056}
                style={{ display: "block", border: "none" }}
                onLoad={handleIframeLoad}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-5 py-2 border-t border-black/[0.06] bg-white">
          <span className="text-[10px] text-black/35">La vista previa es aproximada</span>
          <button
            type="button"
            disabled={exporting || loading || !!error}
            onClick={handleDownload}
            className="rounded-full bg-[#1d1d1f] px-4 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:bg-[#1d1d1f]/90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? "Generando PDF…" : "Descargar PDF"}
          </button>
        </div>

    </div>
    </div>
  );
}
