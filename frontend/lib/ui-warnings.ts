function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}


export function formatAdaptationWarnings(rawWarnings: string[]): string[] {
  // FRAGILE: this matching depends on backend warning strings.
  // TODO: migrate backend/frontend to structured warning codes.
  return dedupe(
    rawWarnings.map((warning) => {
      const normalized = warning.toLowerCase();

      // Must precede the "modo profundo" branch below: that one describes the
      // approval gate, and this warning also mentions deep mode while meaning
      // the opposite — the stage never ran.
      if (normalized.includes("no pudo completarse")) {
        return "El analisis de habilidades transferibles no pudo completarse; el CV se adapto sin esa etapa, asi que no se te propusieron habilidades para aprobar.";
      }

      if (normalized.includes("algunos bullets no fueron reescritos")) {
        return "Algunos bullets no pudieron optimizarse automaticamente; los veras marcados como sin cambios.";
      }

      if (normalized.includes("fallback heur") || normalized.includes("finalizaci") || normalized.includes("llm no devolvi")) {
        return "No se pudo completar toda la adaptacion con IA; se muestra una version de respaldo para que la revises manualmente.";
      }

      if (normalized.includes("falta la api key") || normalized.includes("api key") || normalized.includes("modelo configurado")) {
        return "Falta la clave de API o el modelo no esta correctamente configurado. Revisa la configuracion del proveedor.";
      }

      if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("network")) {
        return "La respuesta del modelo fallo por red o tiempo de espera. Revisa el resultado antes de exportar.";
      }

      if (normalized.includes("modo profundo") || normalized.includes("requieren aprobaci")) {
        return "Las habilidades transferibles propuestas necesitan tu aprobacion antes de incluirse en la version final.";
      }

      // DEBUG: log unknown patterns for diagnosis
      if (typeof window !== "undefined") {
        console.warn("[ui-warnings] unknown adaptation warning pattern:", warning);
      }

      // Unknown pattern: show the backend's own text. Substituting a generic
      // "requires manual review" here mislabels informational notices as
      // failures, which is exactly what happened with the deep-mode notice.
      return warning;
    }),
  );
}
