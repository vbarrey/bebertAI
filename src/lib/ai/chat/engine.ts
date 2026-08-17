import { ChatChunk, ChatRequestInput, GenerateAssistantResponseInput } from "../types";
import { aiProviderRegistry } from "@/lib/ai/registry";

/**
 * Generates an assistant response for a given conversation and message.
 * Should never call prisma but prepare the context for the assistant to answer.
 * @param input
 */
export async function* generateAssistantResponse({
  conversationId,
  message,
  providerId,
  modelId
}: {
  conversationId: string;
  message: string;
  providerId: string;
  modelId: string;
}): AsyncGenerator<ChatChunk> {
  // TODO:
  // - Ajouter le prompt système
  // - Ajouter l'historique
  // - Ajouter le contexte RAG

  const provider = aiProviderRegistry.get(providerId);

  if (!provider)
    throw new Error(
      `Unknown provider ${
        providerId
      } - Known provider (${aiProviderRegistry.getNbProvider()}) are [${aiProviderRegistry
        .getProviderIdList()
        .join(" - ")}]`
    );

  const chatInput: ChatRequestInput = {messages: [{content: message, role: "user"}], modelId: modelId};

  console.log(chatInput)

  yield* provider!.chat(chatInput);
}