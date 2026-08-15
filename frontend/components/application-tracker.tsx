"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { APPLICATION_STATUSES, type ApplicationRecord, type ApplicationStatus } from "@/types/application";

type Props = {
  applications: ApplicationRecord[];
  onOpen: (application: ApplicationRecord) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDetailsChange: (id: string, details: Pick<ApplicationRecord, "notes" | "nextAction">) => void;
  onDelete: (id: string) => void;
};

const labels: Record<ApplicationStatus, string> = {
  guardada: "Guardada",
  aplicada: "Aplicada",
  entrevista: "Entrevista",
  oferta: "Oferta",
  rechazada: "Rechazada",
};

export function ApplicationTracker({ applications, onOpen, onStatusChange, onDetailsChange, onDelete }: Props) {
  return (
    <Card className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">Seguimiento local</p>
          <h2 className="mt-0.5 text-lg font-semibold text-[#1d1d1f]">Mis postulaciones</h2>
        </div>
        <span className="text-xs text-black/42">{applications.length} {applications.length === 1 ? "vacante guardada" : "vacantes guardadas"}</span>
      </div>

      {applications.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-black/55">
          Guardá un análisis para registrar su estado, notas y próxima acción. Todo queda solo en este navegador.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {applications.map((application) => (
            <div key={application.id} className="rounded-2xl border border-black/[0.08] bg-white px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button type="button" onClick={() => onOpen(application)} className="min-w-0 text-left group">
                  <p className="truncate text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0071e3]">{application.job.job_title || "Vacante sin título"}</p>
                  <p className="mt-0.5 text-xs text-black/48">{application.job.company_name || "Empresa no especificada"} · Actualizada {formatDate(application.updatedAt)}</p>
                </button>
                <div className="flex items-center gap-2">
                  {typeof application.score?.score === "number" && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-black/60">{application.score.score}%</span>}
                  <select
                    aria-label={`Estado de ${application.job.job_title || "postulación"}`}
                    value={application.status}
                    onChange={(event) => onStatusChange(application.id, event.target.value as ApplicationStatus)}
                    className="rounded-full border border-black/[0.1] bg-white px-2.5 py-1 text-xs font-medium text-black/65 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                  >
                    {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
                  </select>
                  <button type="button" onClick={() => onDelete(application.id)} aria-label="Eliminar postulación" className="rounded-full p-1.5 text-black/35 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {(application.nextAction || application.notes) && (
                <p className="mt-2 text-xs leading-5 text-black/55">
                  {application.nextAction && <><span className="font-semibold text-black/65">Siguiente acción:</span> {application.nextAction}</>}
                  {application.nextAction && application.notes && " · "}
                  {application.notes}
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-black/48 hover:text-black/70">Notas y próxima acción</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    defaultValue={application.nextAction}
                    placeholder="Ej. dar seguimiento el viernes"
                    onBlur={(event) => onDetailsChange(application.id, { notes: application.notes, nextAction: event.target.value })}
                    className="rounded-xl border border-black/[0.1] px-3 py-2 text-xs text-black/70 outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                  <input
                    defaultValue={application.notes}
                    placeholder="Notas privadas"
                    onBlur={(event) => onDetailsChange(application.id, { nextAction: application.nextAction, notes: event.target.value })}
                    className="rounded-xl border border-black/[0.1] px-3 py-2 text-xs text-black/70 outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                </div>
              </details>
              <button type="button" onClick={() => onOpen(application)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0071e3] hover:underline">
                Abrir análisis <ExternalLink size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "recientemente" : new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(date);
}
