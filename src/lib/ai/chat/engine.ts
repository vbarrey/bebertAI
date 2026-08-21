import { getConversationMessages } from "@/lib/queries/message";
import { ChatChunk, ChatRequestInput } from "../types";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { MessageRole } from "@prisma/client";
import { messageRoleToString } from "@/lib/utils";

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

  if (!provider){
    throw new Error(
      `Unknown provider ${
        providerId
      } - Known provider (${aiProviderRegistry.getNbProvider()}) are [${aiProviderRegistry
        .getProviderIdList()
        .join(" - ")}]`
    );
  }

  // Get all messages from the conversation and format them for the assistant.
  // This list already contains the last message from the user.
  const messages = await getConversationMessages(conversationId);
  const formatMessages = messages.map((msg) => {
    return {
      role: messageRoleToString(msg.role),
      content: msg.content,
    };
  });

  const chatInput: ChatRequestInput = {messages: formatMessages, modelId: modelId};

  yield* provider!.chat(chatInput);
}