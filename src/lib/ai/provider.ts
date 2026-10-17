import { AIModelInfo, ChatRequestInput, ChatChunk, EmbedRequest, Embedding } from "./types";

export interface AIProviderClient {
  id: string;
  name: string;

  models(): Promise<AIModelInfo[]>;
  hasModel(modelName: string): Promise<boolean>;

  chat(appImput: ChatRequestInput): AsyncGenerator<ChatChunk>;

  pull?(): Promise<void>;

  remove?(): Promise<void>;

  // Paid remote models: true when the model is refused without usage credits, undefined when unknown.
  requiresCredits?(modelName: string): Promise<boolean | undefined>;

  updateConfig(config: unknown): Promise<void>;

  embed(input: EmbedRequest): Promise<Embedding[]>;
}