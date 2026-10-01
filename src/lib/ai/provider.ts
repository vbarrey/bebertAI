import { AIModelInfo, ChatRequestInput, ChatChunk, EmbedRequest, Embedding } from "./types";

export interface AIProviderClient {
  id: string;
  name: string;

  models(): Promise<AIModelInfo[]>;
  hasModel(modelName: string): Promise<boolean>;

  chat(appImput: ChatRequestInput): AsyncGenerator<ChatChunk>;

  pull?(): Promise<void>;

  remove?(): Promise<void>;

  updateConfig(config: unknown): Promise<void>;

  embed(input: EmbedRequest): Promise<Embedding[]>;
}