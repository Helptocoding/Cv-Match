"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { exportCV } from "@/lib/api";
import type { AdaptedCV } from "@/types/scoring";
import clsx from "clsx";


const FORMAT_OPTIONS = ["PDF", "DOCX", "Markdown"] as const;
const TEMPLATE_OPTIONS = ["Harvard", "Moderno"] as const;

type Format = (typeof FORMAT_OPTIONS)[number];
type Template = (typeof TEMPLATE_OPTIONS)[number];

const formatMap: Record<Format, "pdf" | "docx" | "md"> = {
  PDF: "pdf",
  DOCX: "docx",
  Markdown: "md",
};


type Props = {
  adapted?: AdaptedCV;
  disabled: boolean;
  onStatus: (message: string) => void;
};


async function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}


export function ExportPanel({ adapted, disabled, onStatus }: Props) {
  const [format, setFormat] = useState<Format>("PDF");
  const [template, setTemplate] = useState<Template>("Harvard");
  const [busy, setBusy] = useState(false);

  const canExport = Boolean(adapted) && !disabled && !busy;

  async function handleExport() {
    if (!adapted || busy) return;
    setBusy(true);
    const ext = formatMap[format];
    try {
      const blob = await exportCV(adapted, ext);
      const fileName = `cv-matcher-${template.toLowerCase()}.${ext}`;
      await downloadBlob(blob, fileName);
      onStatus(`${format} exportado con plantilla ${template}.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : `Error al exportar ${format}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Exportar CV</p>

      <SegmentedControl label="Formato" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />

      <div>
        <p className="mb-2 text-xs font-medium text-black/45">Plantilla</p>
        <div className="flex gap-1.5">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setTemplate(opt)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                opt === template
                  ? "bg-ink text-white"
                  : "bg-black/[0.05] text-black/55 hover:bg-black/[0.08]"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-black/35">
          {template === "Harvard" ? "Serif formal, estructura Harvard." : "Sans-serif limpio y moderno."}
        </p>
      </div>

      <button
        type="button"
        disabled={!canExport}
        onClick={handleExport}
        className={clsx(
          "inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-150",
          canExport
            ? "bg-ink text-white shadow-sm hover:bg-ink/90 active:scale-[0.98]"
            : "cursor-not-allowed bg-black/[0.05] text-black/30"
        )}
      >
        <Download size={15} strokeWidth={2} />
        {busy ? "Exportando…" : "Exportar CV"}
      </button>
    </div>
  );
}
