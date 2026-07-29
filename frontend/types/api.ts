export type ProviderConfig = {
  provider: string;
  model: string;
  apiKey: string;
  persistKey: boolean;
};

export type ProviderDefinition = {
  id: string;
  name: string;
  keyPlaceholder: string;
  keyPattern?: string;
  defaultModel: string;
  models: string[];
};

export type ParseResponse = Record<string, unknown>;

export type ProviderValidationReason =
  | "ok"
  | "invalid_key"
  | "model_not_available"
  | "rate_limited"
  | "unreachable"
  | "unknown";

export type ProviderValidationResult = {
  valid: boolean;
  reason: ProviderValidationReason;
  message: string;
  provider: string;
  model: string;
};
