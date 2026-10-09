import type { Message as PrismaMessage } from "@prisma/client";
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
  message,
  history,
}: {
  conversationId: string;
  message: string;
  // Conversation messages, the last one being the user message to answer.
  history: PrismaMessage[];
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
    neighborChunks: retrieval.neighborChunks,
  });

  const ragContext = buildRagContext(retrievedChunks);

  const formatMessages = history.map((msg) => {
    return {
      role: messageRoleToString(msg.role),
      content: msg.content,
    };
  });

  const ragMessage: Message = {
    role: "system",
    content: ragContext,
  };

  // The documentary context goes right before the question it was retrieved for.
  const previousMessages = formatMessages.slice(0, -1);
  const question = formatMessages.slice(-1);

  const chatInput: ChatRequestInput = {
    messages: [
      {
        role: "system",
        content: generation.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
      },
      ...previousMessages,
      ...(ragContext ? [ragMessage] : []),
      ...question,
    ],
    modelName: generationModel.modelName,
    temperature: generation.temperature,
    maxTokens: generation.maxTokens,
    think: generation.think,
  };

  yield* generationProvider.chat(chatInput);
}