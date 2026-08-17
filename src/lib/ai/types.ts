
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
  modelId: string;
  messages: Message[];
}

export interface ChatChunk {
  role: "system" | "user" | "assistant";
  content: string;
}

export type GenerateAssistantResponseInput = {
    providerId: string;
    conversationId: string;
    chatInput: ChatRequestInput
}