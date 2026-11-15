
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
    ("defaultModel" in config && config.defaultModel != null && typeof config.defaultModel !== "string")
  ) {
    throw new Error("Invalid Ollama Cloud configuration");
  }

  return {
    // Always ollama.com, whatever was stored: an address chosen by the user would make the server call any address,
    // the internal services of its Docker network included (Qdrant, Redis).
    host: OLLAMA_CLOUD_HOST,
    apiKey: config.apiKey,
    defaultModel: "defaultModel" in config ? (config.defaultModel as string | undefined) : undefined,
  };
}
