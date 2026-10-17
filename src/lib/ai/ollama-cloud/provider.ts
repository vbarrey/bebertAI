// BebertAI types
import { AIModelInfo, ChatChunk, ChatRequestInput, Embedding } from "../types";
import { AIProviderClient } from "../provider";

// Ollama types, shared with Ollama local
import { toAppModel, toOlllamaChatRequest, toAppChatChunk } from "../ollama-local/transform";
import { OllamaError } from "../ollama-local/errors";

import { OllamaCloudClient } from "./client";
import { OllamaCloudConfiguration, parseOllamaCloudConfig } from "./config";

export class OllamaCloudProvider implements AIProviderClient {
  id: string;
  name: string;
  client: OllamaCloudClient;

  constructor(id: string, name: string, config: OllamaCloudConfiguration) {
    this.id = id;
    this.name = name ?? "OLLAMA CLOUD";
    this.client = new OllamaCloudClient(config);
  }

  async models(): Promise<AIModelInfo[]> {
    const models = await this.client.models();
    return models.map(toAppModel);
  }

  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.client.models();
    return models.some(m => m.name === modelName);
  }

  async *chat(appInput: ChatRequestInput): AsyncGenerator<ChatChunk> {
    const input = await toOlllamaChatRequest(appInput);
    for await (const ollamaChunk of this.client.chat(input)) {
      yield toAppChatChunk(ollamaChunk);
    }
  }

  async checkApiKey(): Promise<void> {
    return this.client.checkApiKey();
  }

  async requiresCredits(modelName: string): Promise<boolean | undefined> {
    return this.client.requiresCredits(modelName);
  }

  async updateConfig(config: unknown): Promise<void> {
    this.client = new OllamaCloudClient(parseOllamaCloudConfig(config));
  }

  // Ollama Cloud has no embedding model (none listed by /api/tags): embeddings stay on Ollama local.
  async embed(): Promise<Embedding[]> {
    throw new OllamaError("Ollama Cloud ne propose pas de modèle d'embedding. Choisissez Ollama local pour l'embedding dans Réglages > Pipeline.");
  }
}
