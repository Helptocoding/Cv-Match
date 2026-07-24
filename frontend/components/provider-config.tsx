import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "@/lib/constants";
import { Card } from "@/components/ui/card";


export function ProviderConfigPanel() {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black/50">
            <path d="M12 2a10 10 0 1 0 10 10h-10V2Z" />
            <path d="M12 12 2.3 7.3" />
            <path d="M12 12 21.7 7.3" />
          </svg>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-black/45">Provider</p>
          <p className="text-sm font-medium text-ink">{DEFAULT_PROVIDER} — {DEFAULT_MODEL}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-black/45">Configuración fija. No requiere API key manual.</p>
    </Card>
  );
}
