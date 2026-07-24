"use client";

import { DEFAULT_CONFIG } from "@/lib/constants";
import type { ProviderConfig } from "@/types/api";


export function useApiKey() {
  const config: ProviderConfig = DEFAULT_CONFIG;

  function updateConfig(_next: ProviderConfig) {
    // Fixed config — no changes allowed
  }

  return { config, updateConfig };
}
