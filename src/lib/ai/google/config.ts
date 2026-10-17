
export interface GoogleConfiguration {
  apiKey: string;
  defaultModel?: string;
}

export function parseGoogleConfig(config: unknown): GoogleConfiguration {
  if (
    typeof config !== "object" ||
    config === null ||
    !("apiKey" in config) ||
    typeof config.apiKey !== "string" ||
    !config.apiKey ||
    ("defaultModel" in config && config.defaultModel != null && typeof config.defaultModel !== "string")
  ) {
    throw new Error("Invalid Google configuration");
  }

  return {
    apiKey: config.apiKey,
    defaultModel: "defaultModel" in config ? (config.defaultModel as string | undefined) : undefined,
  };
}
