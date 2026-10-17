
export interface AnthropicConfiguration {
  apiKey: string;
  defaultModel?: string;
}

export function parseAnthropicConfig(config: unknown): AnthropicConfiguration {
  if (
    typeof config !== "object" ||
    config === null ||
    !("apiKey" in config) ||
    typeof config.apiKey !== "string" ||
    !config.apiKey ||
    ("defaultModel" in config && config.defaultModel != null && typeof config.defaultModel !== "string")
  ) {
    throw new Error("Invalid Anthropic configuration");
  }

  return {
    apiKey: config.apiKey,
    defaultModel: "defaultModel" in config ? (config.defaultModel as string | undefined) : undefined,
  };
}
