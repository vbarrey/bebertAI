// BebertAI types
import { AIModelInfo, ChatChunk, ChatRequestInput, Embedding, EmbedRequest } from "../types";
import { AIProviderClient } from "../provider";

// Ollama types
import { OllamaLocalClient } from "./client";
import { toAppModel, toOlllamaChatRequest, toAppChatChunk, toOllamaEmbedRequest, toAppEmbeddings } from "./transform";
import { OllamaLocalConfiguration, parseOllamaLocalConfig } from "./config";

export class OllamaLocalProvider implements AIProviderClient {
  id: string;
  name: string;
  client: OllamaLocalClient;

  constructor(id: string, name: string, config: OllamaLocalConfiguration) {
    this.id = id;
    this.name = name ?? "OLLAMA LOCAL";
    this.client = new OllamaLocalClient(config);
  }

  async models(): Promise<AIModelInfo[]> {
    const models = await this.client.models();
    return models.map(toAppModel);
  }

  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.client.models();
    const exists = models.findIndex(m => m.name === modelName);
    return exists != -1;
  }

  async *chat(appInput: ChatRequestInput): AsyncGenerator<ChatChunk> {
    const input = await toOlllamaChatRequest(appInput);
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
    const ollamaConfig = parseOllamaLocalConfig(config);
    this.client = new OllamaLocalClient(ollamaConfig);
  }

  async embed(appInput: EmbedRequest): Promise<Embedding[]> {
    const ollamaInput = toOllamaEmbedRequest(appInput);

    const ollamaEmbeddings = await this.client.embed(ollamaInput);
    return toAppEmbeddings(ollamaEmbeddings);
  }
}
