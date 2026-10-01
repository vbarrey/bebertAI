// BebertAI types
import { AIModelInfo, ChatChunk, ChatRequestInput, Embedding, EmbedRequest } from "../types";
import { AIProviderClient } from "../provider";

// Ollama types
import { OllamaClient } from "./client";
import { toAppModel, toOlllamaChatRequest, toAppChatChunk, toOllamaEmbedRequest, toAppEmbeddings } from "./transform";
import { OllamaProviderConfiguration, parseOllamaConfig } from "./config";
import { prisma } from "@/lib/prisma";

export class OllamaProvider implements AIProviderClient {
  id: string;
  name: string;
  client: OllamaClient;

  constructor(id: string, name: string, config: OllamaProviderConfiguration) {
    this.id = id;
    this.name = name ?? "OLLAMA";
    this.client = new OllamaClient(config);
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
    const ollamaConfig = parseOllamaConfig(config);
    this.client = new OllamaClient(ollamaConfig);
  }

  async embed(appInput: EmbedRequest): Promise<Embedding[]> {
    const ollamaInput = toOllamaEmbedRequest(appInput);

    const requestedModel = await prisma.aIModel.findFirst({where: {name: ollamaInput.model, providerId: this.id}, include: { capabilities: true}});

    if(!requestedModel || !requestedModel.capabilities.some((capability) => capability.name === "EMBEDDING")){
      console.log({name: ollamaInput.model, providerId: this.id});
      throw new Error(`The model ${ollamaInput.model} can not be used for embedding - try another model capable`)
    }

    const ollamaEmbeddings = await this.client.embed(ollamaInput);
    return toAppEmbeddings(ollamaEmbeddings);
  }
}
