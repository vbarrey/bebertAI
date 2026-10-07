import { getConversationMessages } from "@/lib/queries/message";
import { ChatChunk, ChatRequestInput, Message } from "../types";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { messageRoleToString } from "@/lib/utils";
import { getDocumentRetriever } from "@/lib/rag/retrieval/retriever-factory";
import { buildRagContext } from "@/lib/rag/context";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

/**
 * Generates an assistant response for a given conversation and message.
 * Should never call prisma but prepare the context for the assistant to answer.
 * @param input
 */
export async function* generateAssistantResponse({
  conversationId,
  message
}: {
  conversationId: string;
  message: string;
}): AsyncGenerator<ChatChunk> {
  // TODO:
  // - Ajouter le prompt système
  // - Ajouter l'historique
  // - Ajouter le contexte RAG

  const config = await pipelineRuntime.getConfig();

  const generationProvider = aiProviderRegistry.get(config.parameters.generation.providerId);
  const embeddingProvider = aiProviderRegistry.get(config.parameters.embedding.request.providerId);

  if (!generationProvider) {
    throw new Error(
      `Unknown provider ${config.parameters.generation.providerId} for the response generation - Known provider (${aiProviderRegistry.getNbProvider()}) are [${aiProviderRegistry
        .getProviderIdList()
        .join(" - ")}]`
    );
  }

  if (!embeddingProvider) {
    throw new Error(
      `Unknown provider ${config.parameters.embedding.request.providerId} for the response embedding - Known provider (${aiProviderRegistry.getNbProvider()}) are [${aiProviderRegistry
        .getProviderIdList()
        .join(" - ")}]`
    );
  }

  const retriever = await getDocumentRetriever(
    embeddingProvider,
    config.parameters.embedding.request.modelName,
  );

  const retrievedChunks = await retriever.retrieve(message);

  const ragContext = buildRagContext(retrievedChunks);

  // Get all messages from the conversation and format them for the assistant.
  // This list already contains the last message from the user.
  const messages = await getConversationMessages(conversationId);
  const formatMessages = messages.map((msg) => {
    return {
      role: messageRoleToString(msg.role),
      content: msg.content,
    };
  });

  const ragMessage: Message = {
    role: "system",
    content: `Contexte documentaire :
              ${ragContext}`
  };

  const chatInput: ChatRequestInput = {
    messages: [
      {
        role: "system",
        content: `Tu es l'assistant de Bebert AI.
                  Tu aides l'utilisateur à répondre à ses questions en utilisant les informations disponibles dans la conversation.
                  Certains messages système peuvent contenir du contexte provenant de la documentation de l'utilisateur. Lorsque ce contexte est fourni, utilise-le comme source d'information pour répondre à la question.
                  Si le contexte documentaire ne contient pas suffisamment d'informations pour répondre, indique-le plutôt que d'inventer des informations.`
      },
      ...formatMessages,
      ...(ragContext ? [ragMessage] : [])
    ],
    modelName: config.parameters.generation.modelName,
  };

  yield* generationProvider!.chat(chatInput);
}