import Anthropic from "@anthropic-ai/sdk";

// BebertAI types
import { AIModelInfo, ChatChunk, ChatRequestInput, Embedding } from "../types";
import { AIProviderClient } from "../provider";
import { ProviderError } from "../errors";

import { AnthropicConfiguration, parseAnthropicConfig } from "./config";
import { toAnthropicChatRequest, toAppModel } from "./transform";

export class AnthropicError extends ProviderError {
  constructor(message: string, options?: ErrorOptions) {
    super(`[ANTHROPIC] ${message}`, options);
    this.name = "AnthropicError";
  }
}

export class AnthropicProvider implements AIProviderClient {
  id: string;
  name: string;
  client: Anthropic;

  constructor(id: string, name: string, config: AnthropicConfiguration) {
    this.id = id;
    this.name = name ?? "ANTHROPIC";
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  // Needs the API key, unlike Ollama Cloud: it also checks the key.
  async models(): Promise<AIModelInfo[]> {
    const models: AIModelInfo[] = [];
    try {
      for await (const model of this.client.models.list()) {
        models.push(toAppModel(model));
      }
    } catch (error) {
      throw toAnthropicError(error);
    }
    return models;
  }

  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.models();
    return models.some((model) => model.name === modelName);
  }

  async *chat(appInput: ChatRequestInput): AsyncGenerator<ChatChunk> {
    const stream = this.client.messages.stream(toAnthropicChatRequest(appInput));

    let hasContent = false;
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          hasContent = true;
          yield { role: "assistant", content: event.delta.text };
        }
      }
    } catch (error) {
      throw toAnthropicError(error);
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new AnthropicError(
        `Le modèle a refusé de répondre${message.stop_details?.explanation ? ` : ${message.stop_details.explanation}` : "."}`,
      );
    }
    if (!hasContent) {
      throw new AnthropicError(
        message.stop_reason === "max_tokens"
          ? `Réponse vide : la limite de ${message.usage.output_tokens} tokens a été atteinte avant la réponse (réflexion du modèle ?). Augmentez le nombre maximal de tokens dans Paramètres > Pipeline.`
          : `Réponse vide du modèle (stop_reason: ${message.stop_reason}).`,
      );
    }
  }

  async checkApiKey(): Promise<void> {
    await this.models();
  }

  async updateConfig(config: unknown): Promise<void> {
    this.client = new Anthropic({ apiKey: parseAnthropicConfig(config).apiKey });
  }

  async embed(): Promise<Embedding[]> {
    throw new AnthropicError("Anthropic ne propose pas d'API d'embedding. Choisissez Ollama local pour l'embedding dans Paramètres > Pipeline.");
  }
}

function toAnthropicError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError) {
    return new AnthropicError("Clé API Anthropic refusée.", { cause: error });
  }
  if (error instanceof Anthropic.APIError && error.type === "billing_error") {
    return new AnthropicError("Crédits Anthropic insuffisants : ajoutez des crédits sur platform.claude.com.", { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    return new AnthropicError(`${error.status ?? ""} ${error.message}`.trim(), { cause: error });
  }
  return error;
}
