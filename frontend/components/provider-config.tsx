"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { validateProvider } from "@/lib/api";
import { SUPPORTED_PROVIDERS } from "@/lib/constants";
import type { ProviderConfig, ProviderDefinition, ProviderValidationResult } from "@/types/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProviderIcon } from "@/components/provider-icons";


type Props = {
  config: ProviderConfig;
  onSave: (config: ProviderConfig) => void;
  onClose: () => void;
};

const providerMap = new Map(SUPPORTED_PROVIDERS.map((p) => [p.id, p]));

// Reasons where the provider gave a definitive verdict against this key/model
// pair. Anything else (network trouble, unexpected provider error) is only a
// warning: it would be wrong to lock the user out over our own inability to
// reach the provider.
const BLOCKING_REASONS = new Set(["invalid_key", "model_not_available"]);

export function ProviderConfigPanel({ config, onSave, onClose }: Props) {
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [persistKey, setPersistKey] = useState(config.persistKey);
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ProviderValidationResult | null>(null);

  const def = providerMap.get(provider);
  const models = def?.models ?? [];
  const currentModelInList = models.includes(model);
  const effectiveModel = currentModelInList ? model : (def?.defaultModel ?? model);
  const keyLooksValid = def?.keyPattern
    ? new RegExp(def.keyPattern).test(apiKey.trim())
    : true;

  // A verdict only describes the exact triple it was obtained for, so any edit
  // invalidates it and the user has to re-verify before saving.
  useEffect(() => {
    setResult(null);
  }, [provider, effectiveModel, apiKey]);

  const handleProviderChange = useCallback((newProvider: string) => {
    setProvider(newProvider);
    const pdef = providerMap.get(newProvider);
    if (pdef) {
      setModel(pdef.defaultModel);
    }
  }, []);

  const commit = useCallback(() => {
    onSave({
      provider,
      model: effectiveModel,
      apiKey,
      persistKey,
    });
    onClose();
  }, [provider, effectiveModel, apiKey, persistKey, onSave, onClose]);

  const handleSave = useCallback(async () => {
    setChecking(true);
    try {
      const outcome = await validateProvider({
        provider,
        model: effectiveModel,
        apiKey,
        persistKey,
      });
      setResult(outcome);
      if (outcome.valid) {
        commit();
      }
    } catch (e) {
      // The backend itself was unreachable — report it, but do not block: the
      // user may be configuring the app before the API is up.
      setResult({
        valid: false,
        reason: "unreachable",
        message: e instanceof Error ? e.message : "No se pudo verificar la API key.",
        provider,
        model: effectiveModel,
      });
    } finally {
      setChecking(false);
    }
  }, [provider, effectiveModel, apiKey, persistKey, commit]);

  const hasKey = apiKey.trim().length > 0;
  const blocked = result !== null && !result.valid && BLOCKING_REASONS.has(result.reason);
  const canSaveAnyway = result !== null && !result.valid && !blocked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">
            Configuración del proveedor
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-black/35 transition-colors hover:bg-black/[0.06] hover:text-black/60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
              Proveedor
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl border border-black/[0.09] bg-white/70 px-3.5 py-2.5 text-[14px] text-[#1d1d1f] transition-colors hover:border-black/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30"
                >
                  {(() => {
                    const Icon = getProviderIcon(provider);
                    return <Icon size={16} className="opacity-60" aria-hidden="true" />;
                  })()}
                  <span className="flex-1 text-left">{providerMap.get(provider)?.name ?? provider}</span>
                  <ChevronDown size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {SUPPORTED_PROVIDERS.map((p: ProviderDefinition) => {
                  const Icon = getProviderIcon(p.id);
                  return (
                    <DropdownMenuItem key={p.id} onSelect={() => handleProviderChange(p.id)}>
                      <Icon size={16} className="opacity-60" aria-hidden="true" />
                      {p.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Model */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
              Modelo
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl border border-black/[0.09] bg-white/70 px-3.5 py-2.5 text-[14px] text-[#1d1d1f] transition-colors hover:border-black/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30"
                >
                  <span className="flex-1 truncate text-left font-mono text-[13px]">{effectiveModel}</span>
                  <ChevronDown size={16} strokeWidth={2} className="opacity-60 shrink-0" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto">
                {models.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-black/40">No hay modelos listados</div>
                ) : (
                  models.map((m) => (
                    <DropdownMenuItem key={m} onSelect={() => setModel(m)}>
                      <span className="flex-1 font-mono text-[13px]">{m}</span>
                      {m === effectiveModel && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#0071e3] shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={def?.keyPlaceholder ?? "Ingresá tu API key"}
                className="w-full rounded-xl border border-black/[0.09] bg-white/70 px-3.5 py-2.5 pr-10 text-[14px] text-[#1d1d1f] placeholder:text-black/30 transition-colors hover:border-black/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/35 transition-colors hover:text-black/60"
                tabIndex={-1}
              >
                {showKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {!keyLooksValid && apiKey.trim() && !result && (
              <p className="mt-1 text-xs text-amber-700">
                El formato no coincide con el de una clave de {def?.name}. Al aplicar se verifica
                contra el proveedor.
              </p>
            )}

            {result && (
              <div
                role="status"
                className={`mt-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
                  result.valid
                    ? "border-emerald-600/20 bg-emerald-50 text-emerald-900"
                    : blocked
                      ? "border-red-600/20 bg-red-50 text-red-900"
                      : "border-amber-600/20 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="font-semibold">
                  {result.valid
                    ? "Credenciales verificadas"
                    : result.reason === "invalid_key"
                      ? `La API key no pertenece a ${def?.name ?? provider}`
                      : result.reason === "model_not_available"
                        ? `El modelo no está disponible con esta key`
                        : "No se pudo verificar la API key"}
                </p>
                <p className="mt-1 opacity-90">{result.message}</p>
              </div>
            )}
          </div>

          {/* Persist toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3.5 py-3 transition-colors hover:bg-black/[0.04]">
            <input
              type="checkbox"
              checked={persistKey}
              onChange={(e) => setPersistKey(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 text-[#0071e3] focus:ring-[#0071e3]/30"
            />
            <div>
              <p className="text-sm font-medium text-[#1d1d1f]">Recordar configuración</p>
              <p className="text-xs text-black/40">Guardar en este navegador (localStorage)</p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-black/[0.1] px-4 py-2.5 text-sm font-medium text-black/55 transition-all hover:border-black/[0.2] hover:text-black/75 active:scale-[0.97]"
          >
            Cancelar
          </button>
          {canSaveAnyway && (
            <button
              type="button"
              onClick={commit}
              className="flex-1 rounded-xl border border-black/[0.1] px-4 py-2.5 text-sm font-medium text-black/55 transition-all hover:border-black/[0.2] hover:text-black/75 active:scale-[0.97]"
            >
              Guardar igual
            </button>
          )}
          <button
            type="button"
            disabled={!hasKey || checking || blocked}
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1d1d1f]/88 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {checking ? "Verificando..." : blocked ? "Corregí la configuración" : "Verificar y aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
