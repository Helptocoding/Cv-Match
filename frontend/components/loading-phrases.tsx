"use client";

import { useEffect, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

const PHRASES = [
  "Analizando tus habilidades técnicas…",
  "Identificando palabras clave de la vacante…",
  "Comparando perfil con los requisitos…",
  "Evaluando tu experiencia laboral…",
  "Buscando habilidades transferibles…",
  "Optimizando para sistemas ATS…",
  "Detectando fortalezas del perfil…",
  "Mapeando brechas de habilidades…",
  "Traduciendo al vocabulario del rol objetivo…",
  "Leyendo entre líneas del CV…",
  "Calculando compatibilidad semántica…",
  "Procesando historial de experiencia…",
  "Identificando logros cuantificables…",
  "Reescribiendo bullets con mayor impacto…",
  "Alineando con las responsabilidades del puesto…",
  "Adaptando el resumen profesional…",
  "Verificando cronología de experiencia…",
  "Buscando evidencia de habilidades implícitas…",
  "Analizando requisitos educativos…",
  "Optimizando el perfil para la vacante…",
  "Construyendo el borrador adaptado…",
  "Revisando tecnologías mencionadas…",
  "Afinando el lenguaje para el sector…",
  "Identificando proyectos relevantes…",
  "Evaluando años de experiencia acumulada…",
  "Cotejando habilidades blandas y duras…",
  "Priorizando los logros más impactantes…",
  "Traduciendo tecnicismos al dominio objetivo…",
  "Verificando consistencia del perfil…",
  "Analizando el contexto del mercado laboral…",
  "Preparando recomendaciones personalizadas…",
  "Procesando historial de educación…",
  "Identificando certificaciones relevantes…",
  "Ajustando el tono del resumen profesional…",
  "Revisando concordancia de palabras clave…",
  "Detectando oportunidades de mejora…",
  "Construyendo análisis de compatibilidad…",
  "Evaluando transferibilidad del perfil…",
  "Mapeando responsabilidades anteriores al rol…",
  "Optimizando visibilidad ante reclutadores…",
  "Analizando requisitos imprescindibles…",
  "Identificando habilidades no listadas explícitamente…",
  "Preparando sugerencias de reescritura…",
  "Calibrando la adaptación del contenido…",
  "Revisando idiomas y certificaciones declaradas…",
  "Procesando logros y métricas del CV…",
  "Alineando experiencia con la oferta laboral…",
  "Ajustando vocabulario al puesto objetivo…",
  "Evaluando fit entre perfil y empresa…",
  "Sintetizando el análisis completo…",
  "Puliendo los últimos detalles…",
  "Casi listo, revisando una vez más…",
  "Construyendo tu CV optimizado…",
  "Verificando que no se invente nada…",
  "Preparando el resultado final…",
];

type Props = {
  label: string;
};

export function LoadingPhrases({ label }: Props) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * PHRASES.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % PHRASES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="animate-pulse-subtle">
        <ThinkingOrb state="working" size={64} />
      </div>
      <p className="text-sm font-semibold text-black/50 animate-fade-in-up" key={label} style={{ animationDuration: "0.4s" }}>{label}</p>
      <div className="relative h-5 overflow-hidden">
        <p
          key={idx}
          className="animate-slide-up max-w-xs text-center text-sm text-black/35"
        >
          {PHRASES[idx]}
        </p>
      </div>
      {/* Subtle progress bar */}
      <div className="mt-2 h-0.5 w-32 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full w-full animate-shimmer rounded-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
      </div>
    </div>
  );
}
