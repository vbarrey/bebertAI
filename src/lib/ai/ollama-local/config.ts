
export interface OllamaLocalConfiguration {
  host: string;
  defaultModel: string;
}

export function parseOllamaLocalConfig(config: unknown): OllamaLocalConfiguration {
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