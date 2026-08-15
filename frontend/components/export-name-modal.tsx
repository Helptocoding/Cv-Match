"use client";

import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";


export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function buildDownloadName(name: string, ext: string): string {
  const base = sanitizeFileName(name).replace(/\.[a-zA-Z0-9]+$/, "");
  return `${base || "cv-matcher"}.${ext}`;
}


type Props = {
  title: string;
  defaultValue: string;
  ext: string;
  busy: boolean;
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
};


export function ExportNameModal({ title, defaultValue, ext, busy, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(defaultValue);
  const canConfirm = sanitizeFileName(name).length > 0 && !busy;
  const finalName = buildDownloadName(name, ext);

  function handleSubmit() {
    if (!canConfirm) return;
    onConfirm(finalName);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Exportar"
        className="w-full max-w-sm rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.12)] animate-scale-in-bounce"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-black/45">Exportar</p>
            <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight text-[#1d1d1f]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-black/[0.05] hover:text-black/70 active:scale-[0.92]"
          >
            <X size={16} className="text-black/40" />
          </button>
        </div>

        <p className="mt-3 text-[12px] leading-5 text-black/45">
          Elegí el nombre del archivo a descargar.
        </p>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder="Nombre del archivo"
          className="mt-3 w-full rounded-xl border border-black/[0.09] bg-white/70 px-3.5 py-2.5 text-[14px] leading-relaxed text-[#1d1d1f] placeholder:text-black/30 transition-colors duration-150 hover:border-black/[0.15] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 focus-visible:border-[#0071e3]/40"
        />

        <p className="mt-1.5 text-[11px] text-black/35">
          Se descargará como <span className="font-medium text-black/55">{finalName}</span>
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-black/[0.12] bg-white/70 px-4 py-1.5 text-[13px] font-medium text-black/55 transition-all duration-150 hover:border-black/[0.2] hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleSubmit}
            className={clsx(
              "rounded-full px-4 py-1.5 text-[13px] font-medium text-white transition-all duration-150 active:scale-[0.97]",
              canConfirm
                ? "bg-[#0071e3] shadow-[0_2px_8px_rgba(0,113,227,0.35)] hover:bg-[#0077ed]"
                : "cursor-not-allowed bg-black/[0.1] text-black/30"
            )}
          >
            {busy ? "Exportando…" : "Descargar"}
          </button>
        </div>
      </div>
    </div>
  );
}