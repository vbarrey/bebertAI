import { ollamaProviderClient } from "./ollama/provider";
import { AIProviderType } from "@prisma/client";

const providers = {
    OLLAMA: ollamaProviderClient,
    OPENAI: null, // openAIProviderClient,
    ANTHROPIC: null // anthropicProviderClient,
};

export function getProvider(type: AIProviderType) {
    return providers[type];
}