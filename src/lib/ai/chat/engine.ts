import { getConversationMessages } from "@/lib/queries/message";
import { ChatChunk, ChatRequestInput, Message } from "../types";
import { messageRoleToString } from "@/lib/utils";
import { getDocumentRetriever } from "@/lib/rag/retrieval/retriever-factory";
import { buildRagContext } from "@/lib/rag/context";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/pipeline/default";
import { getConversationModel } from "@/lib/queries/conversation";

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
  const config = await pipelineRuntime.getConfig();
  const { embedding, retrieval, generation } = config.parameters;

  // The conversation keeps the model it was started with; the pipeline model is only the default.
  const conversationModel = (await getConversationModel(conversationId))?.model;
  const generationModel = conversationModel
    ? { providerId: conversationModel.providerId, modelName: conversationModel.name }
    : generation;

  const generationProvider = getPipelineProvider(generationModel, "génération");
  const embeddingProvider = getPipelineProvider(embedding, "embedding");

  const retriever = await getDocumentRetriever(
    embeddingProvider,
    embedding.modelName,
  );

  const retrievedChunks = await retriever.retrieve(message, {
    limit: retrieval.topK,
    scoreThreshold: retrieval.scoreThreshold,
  });

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
        content: generation.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
      },
      ...formatMessages,
      ...(ragContext ? [ragMessage] : [])
    ],
    modelName: generationModel.modelName,
    temperature: generation.temperature,
    maxTokens: generation.maxTokens,
  };

  yield* generationProvider.chat(chatInput);
}