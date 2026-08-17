import { AIModelInfo, ChatRequestInput, ChatChunk } from "./types";

export interface AIProviderClient {
  name: string;

  models(): Promise<AIModelInfo[]>;

  chat(appImput: ChatRequestInput): AsyncGenerator<ChatChunk>;

  pull?(): Promise<void>;

  remove?(): Promise<void>;

  updateConfig(config: unknown): Promise<void>;
}