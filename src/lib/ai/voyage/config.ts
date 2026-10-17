
export interface VoyageConfiguration {
  apiKey: string;
  defaultModel?: string;
}

export function parseVoyageConfig(config: unknown): VoyageConfiguration {
  if (
    typeof config !== "object" ||
    config === null ||
    !("apiKey" in config) ||
    typeof config.apiKey !== "string" ||
    !config.apiKey ||
    ("defaultModel" in config && config.defaultModel != null && typeof config.defaultModel !== "string")
  ) {
    throw new Error("Invalid Voyage configuration");
  }

  return {
    apiKey: config.apiKey,
    defaultModel: "defaultModel" in config ? (config.defaultModel as string | undefined) : undefined,
  };
}
