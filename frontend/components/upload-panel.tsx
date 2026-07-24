"use client";

import { Upload } from "lucide-react";


type Props = {
  cvText: string;
  jobText: string;
  onCvTextChange: (value: string) => void;
  onJobTextChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
};


export function UploadPanel({ cvText, jobText, onCvTextChange, onJobTextChange, onFileChange }: Props) {
  return (
    <div className="space-y-3">
      <label className="block text-xs text-black/55">
        <span className="flex items-center gap-1.5 mb-1.5 font-medium">
          <Upload size={12} className="text-black/40" />
          Subir archivo de CV
        </span>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          className="block w-full rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-3 py-2 text-xs transition-colors duration-150 hover:border-black/25 file:mr-2 file:rounded-full file:border-0 file:bg-black/[0.06] file:px-3 file:py-1 file:text-xs file:font-medium"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className="block text-xs text-black/55">
        <span className="mb-1.5 block font-medium">O pegá el texto del CV</span>
        <textarea
          className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-xs leading-relaxed transition-colors duration-150 hover:border-black/18 min-h-[100px]"
          value={cvText}
          onChange={(e) => onCvTextChange(e.target.value)}
          placeholder="Pegá el texto del CV acá…"
        />
      </label>

      <label className="block text-xs text-black/55">
        <span className="mb-1.5 block font-medium">Descripción de la vacante</span>
        <textarea
          className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-xs leading-relaxed transition-colors duration-150 hover:border-black/18 min-h-[100px]"
          value={jobText}
          onChange={(e) => onJobTextChange(e.target.value)}
          placeholder="Pegá el texto de la vacante acá…"
        />
      </label>
    </div>
  );
}
