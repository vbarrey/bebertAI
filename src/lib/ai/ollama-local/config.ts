
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

/**
 * The generation and embedding models of the .env: the pipeline falls back on them and docker compose
 * downloads them, so they cannot be deleted from the app.
 */
export function isOllamaLocalDefaultModel(modelName: string): boolean {
  return [process.env.OLLAMA_DEFAULT_MODEL, process.env.OLLAMA_EMBEDDING_MODEL].includes(modelName);
}
