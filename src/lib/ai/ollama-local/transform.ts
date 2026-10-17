import { prisma } from "@/lib/prisma";
import { Capability } from "@prisma/client";
import { AIModelInfo, ChatRequestInput, ChatChunk, EmbedRequest, Embedding } from "../types";
import { OllamaModel, OllamaChatRequest, OllamaChatChunk, OllamaEmbedRequest, OllamaEmbedResponse} from "./types";

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

export function toOllamaEmbedRequest(appInput: EmbedRequest): OllamaEmbedRequest{
    return {
        model: appInput.model,
        input: appInput.input,
        options: {
            ...(appInput.contextLength ? { num_ctx: appInput.contextLength } : {}),
            ...(appInput.cpuOnly ? { num_gpu: 0 } : {}),
        },
    };
}

export function toAppEmbeddings(ollamaResponse: OllamaEmbedResponse): Embedding[]{
    return ollamaResponse.embeddings;
}
