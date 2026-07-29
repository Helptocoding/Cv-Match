"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_CONFIG } from "@/lib/constants";
import { loadProviderConfig, saveProviderConfig } from "@/lib/storage";
import type { ProviderConfig } from "@/types/api";


export function useApiKey() {
  const [config, setConfig] = useState<ProviderConfig>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadProviderConfig();
    if (saved?.apiKey) {
      setConfig(saved);
    }
    setHydrated(true);
  }, []);

  const updateConfig = useCallback((next: ProviderConfig) => {
    setConfig(next);
    if (next.persistKey && next.apiKey) {
      saveProviderConfig(next);
    }
  }, []);

  const isConfigured = hydrated && Boolean(config.apiKey);

  return { config, updateConfig, isConfigured, hydrated };
}
