// BebertAI types
import { AIModelInfo, ChatChunk, ChatRequestInput } from "../types";
import { AIProviderClient } from "../provider";

// Ollama types
import { OllamaClient } from "./client";
import { toAppModel, toOlllamaChatRequest, toAppChatChunk } from "./transform";
import { OllamaProviderConfiguration, parseOllamaConfig } from "./config";

export class OllamaProvider implements AIProviderClient {
  name: string;
  client: OllamaClient;

  constructor(config: OllamaProviderConfiguration, alterName ?: string){
    this.name = alterName ?? "OLLAMA LOCAL";
    this.client = new OllamaClient(config);
  }

  async models(): Promise<AIModelInfo[]> {
    const models = await this.client.models();
    return models.map(toAppModel);
  }

  async * chat(appInput: ChatRequestInput): AsyncGenerator<ChatChunk> {
    const input = toOlllamaChatRequest(appInput);
    for await (const ollamaChunk of this.client.chat(input)) {
      yield toAppChatChunk(ollamaChunk);
    }
  }

  async pull(): Promise<void> {
    return this.client.pull();
  }

  async remove(): Promise<void> {
    return this.client.remove();
  }

  async updateConfig(config: unknown): Promise<void> {
    const ollamaConfig = parseOllamaConfig(config);
    this.client = new OllamaClient(ollamaConfig);
  }
}
