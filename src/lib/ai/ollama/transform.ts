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

// Same properties 
export async function toOlllamaChatRequest(appChatRequest: ChatRequestInput): Promise<OllamaChatRequest> {
    const res = await prisma.aIModel.findFirst({select: {name:true}, where: {id: appChatRequest.modelId}});

    if(!res || !res.name) {throw new Error('Unable to parse generic chat request to Ollama chat request')}; 

    return {messages: appChatRequest.messages, model: res.name};
}

export function toAppChatChunk(ollamaChatChunk: OllamaChatChunk): ChatChunk {
    return ollamaChatChunk.message;
}

export function toOllamaEmbedRequest(appInput: EmbedRequest): OllamaEmbedRequest{
    return {model: appInput.model, input: appInput.chunks};
}

export function toAppEmbeddings(ollamaResponse: OllamaEmbedResponse): Embedding[]{
    return ollamaResponse.embeddings;
}
