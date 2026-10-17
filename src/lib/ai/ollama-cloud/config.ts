
export interface OllamaCloudConfiguration {
  host: string;
  apiKey: string;
  defaultModel?: string;
}

export const OLLAMA_CLOUD_HOST = "https://ollama.com";

export function parseOllamaCloudConfig(config: unknown): OllamaCloudConfiguration {
  if (
    typeof config !== "object" ||
    config === null ||
    !("apiKey" in config) ||
    typeof config.apiKey !== "string" ||
    !config.apiKey ||
    ("host" in config && typeof config.host !== "string") ||
    ("defaultModel" in config && config.defaultModel != null && typeof config.defaultModel !== "string")
  ) {
    throw new Error("Invalid Ollama Cloud configuration");
  }

  return {
    host: "host" in config && config.host ? (config.host as string) : OLLAMA_CLOUD_HOST,
    apiKey: config.apiKey,
    defaultModel: "defaultModel" in config ? (config.defaultModel as string | undefined) : undefined,
  };
}
