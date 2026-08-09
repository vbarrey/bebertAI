import { AIProviderType } from "@prisma/client";
import { ChatChunk, GenerateAssistantResponseInput } from "../types";
import { getProvider } from "@/lib/ai/registry"

/**
 * Generates an assistant response for a given conversation and message. 
 * Should never call prisma but prepare the context for the assistant to answer.
 * @param input 
 */
export async function* generateAssistantResponse({conversationId, message} : {conversationId: string, message: string}): AsyncGenerator<ChatChunk> {
    // TODO:
    // - Ajouter le prompt système
    // - Ajouter l'historique
    // - Ajouter le contexte RAG

    const input: GenerateAssistantResponseInput = {
        conversationId,
        providerType: AIProviderType.OLLAMA,
        chatInput: {
            model: "qwen3:0.6b",
            messages: [{role: "user", content: message}]
        }
    }

    const provider = getProvider(input.providerType);

    if(!provider) throw new Error(`Unknown provider ${input.providerType}`);

    // Simulate streaming by yielding chunks of the mock response
    yield* provider!.chat(input.chatInput);
}