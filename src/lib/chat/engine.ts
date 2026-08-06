import { streamOllamaModel, OllamaMessage } from "@/lib/llm/ollama";
import { ChatChunk } from "@/lib/chat/type";

import { config } from "@/lib/config";

type GenerateAssistantResponseInput  = {
    conversationId: string;
    message: string;
};

/**
 * Generates an assistant response for a given conversation and message. 
 * Should never call prisma but prepare the context for the assistant to answer.
 * @param input 
 */
export async function* generateAssistantResponse(input: GenerateAssistantResponseInput ): AsyncGenerator<ChatChunk> {
    // TODO:
    // - Ajouter le prompt système
    // - Ajouter l'historique
    // - Ajouter le contexte RAG
    const messages: OllamaMessage[] = [
        { role: "user", content: input.message }
    ];

    // Simulate streaming by yielding chunks of the mock response
    yield* streamOllamaModel({
        model: config.ollama.model,
        messages: messages
    });
}