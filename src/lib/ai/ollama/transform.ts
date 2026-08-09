import { AIModelInfo, ChatRequestInput, ChatChunk } from "../types";
import { OllamaModel, OllamaChatRequest, OllamaChatChunk} from "./types";

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
export function toOlllamaChatRequest(appChatRequest: ChatRequestInput): OllamaChatRequest {
    return appChatRequest as OllamaChatRequest;
}

export function toAppChatChunk(ollamaChatChunk: OllamaChatChunk): ChatChunk {
    return ollamaChatChunk.message;
}
