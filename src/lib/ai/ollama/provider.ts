// BebertAI types
import { AIModelInfo, ChatChunk, ChatRequestInput } from "../types";
import { AIProviderClient } from "../provider";

// Ollama types
import { ollamaClient } from "./client";
import { toAppModel, toOlllamaChatRequest, toAppChatChunk } from "./transform";

async function models(): Promise<AIModelInfo[]> {
  const models = await ollamaClient.models();
  return models.map(toAppModel);
}

async function* chat(appInput: ChatRequestInput): AsyncGenerator<ChatChunk> {
  const input = toOlllamaChatRequest(appInput);
  for await (const ollamaChunk of ollamaClient.chat(input)) {
    yield toAppChatChunk(ollamaChunk);
  }
}

async function pull(): Promise<void> {
  return ollamaClient.pull();
}

async function remove(): Promise<void> {
  return ollamaClient.remove();
}

export const ollamaProviderClient: AIProviderClient = {
  models,
  chat,
  pull,
  remove,
};
