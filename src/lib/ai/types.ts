import type { ChatStep } from "./chat/steps";

export interface AIModelInfo {
  name: string;
  displayName?: string;

  family?: string;
  parameterSize?: string;
  sizeBytes?: bigint | number;
}

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface ChatRequestInput {
  modelName: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  think?: boolean;
}

export interface ChatChunk {
  role: "system" | "user" | "assistant";
  content: string;
}

// One NDJSON line of /api/chat: progress steps until the answer starts, then its content.
export type ChatStreamEvent =
  | { type: "step"; step: ChatStep }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "content"; content: string };

// A document excerpt given to the model, in the order of the "Extrait N" it was given as.
export type ChatSource = {
  documentId: string;
  documentName: string;
  // Best matching chunk of the excerpt, to open the document at its bounding box later.
  chunkId: string;
  pageNumber: number | null;
};

export type GenerateAssistantResponseInput = {
    providerId: string;
    conversationId: string;
    chatInput: ChatRequestInput
}

export type EmbedRequest = {
  model: string;
  input: string[];
}

export type Embedding = number[];

export type ChunkEmbedding = {
  chunkId: string;
  documentId: string;
  embedding: number[];
};