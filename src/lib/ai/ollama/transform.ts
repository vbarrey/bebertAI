import { prisma } from "@/lib/prisma";
import { AIModelInfo, ChatRequestInput, ChatChunk, EmbedRequest, Embedding } from "../types";
import { OllamaModel, OllamaChatRequest, OllamaChatChunk, OllamaEmbedRequest, OllamaEmbedResponse} from "./types";

export function toAppModel(ollamaModel: OllamaModel): AIModelInfo {
    return {
        name: ollamaModel.name,
        displayName: ollamaModel.model,
        family: ollamaModel.details.family,
        parameterSize: ollamaModel.details.parameter_size,
        sizeBytes: ollamaModel.size
    }
}

export async function toOlllamaChatRequest(appChatRequest: ChatRequestInput): Promise<OllamaChatRequest> {
    return {
        messages: appChatRequest.messages,
        model: appChatRequest.modelName,
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
    return {model: appInput.model, input: appInput.input};
}

export function toAppEmbeddings(ollamaResponse: OllamaEmbedResponse): Embedding[]{
    return ollamaResponse.embeddings;
}
