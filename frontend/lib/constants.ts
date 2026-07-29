import type { ProviderConfig, ProviderDefinition } from "@/types/api";
import type { ScoreWeights } from "@/types/scoring";

export const SUPPORTED_PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    keyPlaceholder: "sk-...",
    keyPattern: "^sk-",
    defaultModel: "gpt-5.6-sol",
    models: [
      "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
      "gpt-5.5", "gpt-5.5-pro",
      "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano",
      "gpt-5.4-mini-2026-03-17", "gpt-5.4-nano-2026-03-17",
      "gpt-5.3-codex",
      "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
      "gpt-4.1-2025-04-14", "gpt-4.1-mini-2025-04-14", "gpt-4.1-nano-2025-04-14",
      "o3", "o3-2025-04-16",
      "o3-pro",
      "o4-mini", "o4-mini-2025-04-16",
      "gpt-4o", "gpt-4o-2024-11-20",
      "gpt-4o-mini", "gpt-4o-mini-2024-07-18",
      "gpt-4-turbo", "gpt-4-turbo-2024-04-09",
      "gpt-4", "gpt-4-0613",
      "gpt-4-0125-preview", "gpt-4-1106-preview",
      "gpt-3.5-turbo", "gpt-3.5-turbo-0125",
      "o1", "o1-2024-12-17",
      "gpt-4o-audio-preview", "gpt-4o-audio-preview-2025-06-03",
      "gpt-4o-mini-audio-preview",
      "gpt-4o-search-preview", "gpt-4o-mini-search-preview",
      "chatgpt-4o-latest",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyPlaceholder: "sk-ant-...",
    keyPattern: "^sk-ant-",
    defaultModel: "claude-sonnet-5",
    models: [
      "claude-fable-5", "claude-mythos-5",
      "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
      "claude-opus-4-5-20251101",
      "claude-sonnet-5", "claude-sonnet-4-6", "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    keyPlaceholder: "AIza...",
    keyPattern: "^AIza",
    defaultModel: "gemini-2.5-pro",
    models: [
      "gemini-3.5-flash", "gemini-3.5-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite", "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-3-flash-preview",
      "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite",
      "gemini-2.5-flash-image",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    keyPlaceholder: "sk-...",
    keyPattern: "^sk-",
    defaultModel: "deepseek-v4-flash",
    models: [
      "deepseek-v4-flash", "deepseek-v4-pro",
    ],
  },
  {
    id: "groq",
    name: "Groq",
    keyPlaceholder: "gsk_...",
    keyPattern: "^gsk_",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "llama-3.3-70b-versatile", "llama-3.1-8b-instant",
      "openai/gpt-oss-120b", "openai/gpt-oss-20b",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-guard-4-12b",
      "groq/compound", "groq/compound-mini",
      "qwen/qwen3-32b", "qwen/qwen3.6-27b",
      "moonshotai/kimi-k2-instruct-0905",
    ],
  },
  {
    id: "together",
    name: "Together",
    keyPlaceholder: "...",
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
      "mistralai/Mixtral-8x22B-Instruct-v0.1",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "togethercomputer/llama-3-70b-chat",
      "togethercomputer/llama-3-8b-chat",
      "togethercomputer/CodeLlama-34b-Instruct",
      "togethercomputer/CodeLlama-13b-Instruct",
      "togethercomputer/CodeLlama-7b-Instruct",
      "microsoft/WizardLM-2-8x22B",
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    keyPlaceholder: "...",
    defaultModel: "mistral-large-latest",
    models: [
      "mistral-large-latest", "mistral-large-2407", "mistral-large-2411",
      "mistral-small-latest", "mistral-small-2409",
      "open-mistral-7b", "open-mixtral-8x7b", "open-mixtral-8x22b",
      "mistral-embed",
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    keyPlaceholder: "sk-or-...",
    keyPattern: "^sk-or-",
    defaultModel: "openai/gpt-4o",
    models: [
      "openai/gpt-4o", "openai/gpt-4o-mini",
      "openai/gpt-4-turbo",
      "anthropic/claude-3.5-sonnet", "anthropic/claude-3-haiku",
      "google/gemini-1.5-pro", "google/gemini-1.5-flash",
      "deepseek/deepseek-chat",
      "mistral/mistral-large",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
];

export const DEFAULT_PROVIDER = SUPPORTED_PROVIDERS.find(p => p.id === "groq")!;
export const DEFAULT_MODEL = DEFAULT_PROVIDER.defaultModel;

export const DEFAULT_CONFIG: ProviderConfig = {
  provider: DEFAULT_PROVIDER.id,
  model: DEFAULT_MODEL,
  apiKey: "",
  persistKey: false,
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  skills: 0.35,
  experience: 0.3,
  education: 0.15,
  keywords_ats: 0.2
};
