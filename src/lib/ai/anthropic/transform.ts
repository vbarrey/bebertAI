import type Anthropic from "@anthropic-ai/sdk";
import { Capability } from "@prisma/client";
import { AIModelInfo, ChatRequestInput } from "../types";

// No response length in the pipeline: room for the answer and the model thinking.
const DEFAULT_MAX_TOKENS = 16000;

export function toAppModel(model: Anthropic.ModelInfo): AIModelInfo {
  return {
    name: model.id,
    displayName: model.display_name,
    // Claude models only generate: Anthropic has no embedding API.
    capabilities: [Capability.GENERATION],
  };
}

/**
 * The system messages go to the system prompt. The temperature is not sent: current Claude models refuse it.
 * `think: false` sends no thinking setting (Claude Opus 5.5 cannot disable it, older models then do not think).
 */
export function toAnthropicChatRequest(input: ChatRequestInput): Anthropic.MessageStreamParams {
  const system = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  return {
    model: input.modelName,
    max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(system ? { system } : {}),
    messages: input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
    ...(input.think ? { thinking: { type: "adaptive" } } : {}),
    // Claude requires every object of the schema to close its properties.
    ...(input.format
      ? { output_config: { format: { type: "json_schema", schema: { additionalProperties: false, ...input.format } } } }
      : {}),
  };
}
