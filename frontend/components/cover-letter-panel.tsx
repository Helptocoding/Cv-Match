"use client";

import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import type { CoverLetterResult } from "@/types/cover-letter";


type Props = {
  result: CoverLetterResult;
  onClose: () => void;
};


export function CoverLetterPanel({ result, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(result.cover_letter);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carta-de-presentacion.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] animate-scale-in-bounce">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4 shrink-0 animate-fade-in-up" style={{ animationDuration: "0.35s" }}>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-black/45">Documento</p>
            <h2 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">Carta de Presentación</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-black/[0.05] hover:text-black/70 active:scale-[0.92]"
          >
            <X size={16} className="text-black/40" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 grow animate-fade-in-up" style={{ animationDelay: "80ms", animationDuration: "0.35s" }}>
          {editing ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[400px] rounded-xl border border-black/[0.1] bg-white px-4 py-3.5 text-[14px] leading-relaxed text-[#1d1d1f] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30"
            />
          ) : (
            <div className="whitespace-pre-wrap text-[14px] leading-[1.8] text-[#1d1d1f]">
              {text}
            </div>
          )}

          {result.meta.strategy === "heuristic" && (
            <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50/90 px-4 py-3">
              <p className="text-xs font-semibold text-amber-900">Generada sin IA</p>
              <p className="mt-1 text-xs leading-5 text-amber-900/75">
                La llamada al modelo falló y se rellenó una plantilla fija con tus datos. El texto es
                genérico y no está personalizado para esta vacante — revisalo antes de enviarlo.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-black/[0.06] px-6 py-3 shrink-0 animate-fade-in-up" style={{ animationDelay: "160ms", animationDuration: "0.3s" }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-black/35">
              {result.meta.strategy === "llm"
                ? `IA · ${result.meta.provider} ${result.meta.model}`
                : "Respaldo sin IA"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-150",
                editing
                  ? "bg-[#0071e3] text-white"
                  : "border border-black/[0.12] bg-white/70 text-black/55 hover:border-black/[0.2]"
              )}
            >
              {editing ? "Vista previa" : "Editar"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={clsx(
                "rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-150",
                copied
                  ? "bg-emerald-500 text-white"
                  : "border border-black/[0.12] bg-white/70 text-black/55 hover:border-black/[0.2]"
              )}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-full bg-[#1d1d1f] px-4 py-1.5 text-[13px] font-medium text-white transition-all duration-150 hover:bg-[#1d1d1f]/90 active:scale-[0.97]"
            >
              Descargar TXT
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
