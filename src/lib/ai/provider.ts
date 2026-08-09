import { AIModelInfo, ChatRequestInput, ChatChunk } from "./types";

export interface AIProviderClient {
  models(): Promise<AIModelInfo[]>;

  chat(appImput: ChatRequestInput): AsyncGenerator<ChatChunk>;

  pull?(): Promise<void>;

  remove?(): Promise<void>;
}