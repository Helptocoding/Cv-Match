export type ProviderConfig = {
  provider: string;
  model: string;
  apiKey: string;
  persistKey: boolean;
};

export type ParseResponse = Record<string, unknown>;
