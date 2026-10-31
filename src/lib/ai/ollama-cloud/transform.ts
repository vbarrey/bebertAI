import { Capability } from "@prisma/client";
import { AIModelInfo, ChatRequestInput, ChatChunk } from "../types";
import { OllamaModel, OllamaChatRequest, OllamaChatChunk } from "./types";

export function toAppModel(ollamaModel: OllamaModel): AIModelInfo {
    return {
        name: ollamaModel.name,
        displayName: ollamaModel.model,
        family: ollamaModel.details.family,
        parameterSize: ollamaModel.details.parameter_size,
        sizeBytes: ollamaModel.size,
        capabilities: toAppCapabilities(ollamaModel.capabilities),
    }
}

// Ollama has no reranking capability; the others ("tools", "thinking", "vision"...) are no app capability.
const OLLAMA_CAPABILITIES: Record<string, Capability> = {
    completion: Capability.GENERATION,
    embedding: Capability.EMBEDDING,
};

export function toAppCapabilities(ollamaCapabilities: string[] = []): Capability[] {
    return ollamaCapabilities.flatMap((capability) => OLLAMA_CAPABILITIES[capability] ?? []);
}

export async function toOlllamaChatRequest(appChatRequest: ChatRequestInput): Promise<OllamaChatRequest> {
    return {
        messages: appChatRequest.messages,
        model: appChatRequest.modelName,
        think: appChatRequest.think,
        format: appChatRequest.format,
        options: {
            temperature: appChatRequest.temperature,
            num_predict: appChatRequest.maxTokens,
        },
    };
}

export function toAppChatChunk(ollamaChatChunk: OllamaChatChunk): ChatChunk {
    return ollamaChatChunk.message;
}
