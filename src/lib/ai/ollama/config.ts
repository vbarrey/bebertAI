
export interface OllamaProviderConfiguration {
  host: string;
  defaultModel: string;
}

export function parseOllamaConfig(config: unknown): OllamaProviderConfiguration {
   if (
    typeof config !== "object" ||
    config === null ||
    !("host" in config) ||
    typeof config.host !== "string" ||
    !("defaultModel" in config) ||
    typeof config.defaultModel !== "string"
  ) {
    throw new Error("Invalid Ollama configuration");
  }

  return {host: config.host, defaultModel: config.defaultModel};
}