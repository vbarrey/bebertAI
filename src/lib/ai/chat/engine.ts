import type { Message as PrismaMessage } from "@prisma/client";
import { ChatRequestInput, ChatStreamEvent, Message } from "../types";
import { messageRoleToString } from "@/lib/utils";
import { getDocumentRetriever } from "@/lib/rag/retrieval/retriever-factory";
import { embeddingContextLength } from "@/lib/rag/embedding/embedder";
import { usesLexicalSearch } from "@/lib/rag/retrieval/hybrid-query";
import { translateQuery, untranslatedQuery } from "@/lib/rag/retrieval/query-translator";
import { buildExcerpts, buildRagContext } from "@/lib/rag/context";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/pipeline/default";
import type { PipelineParameters } from "@/lib/pipeline/parameters";
import { getConversationModel } from "@/lib/queries/conversation";
import { getSearchableDocumentIds } from "@/lib/rag/retrieval/document-scope";

const PREVIEW_LENGTH = 300;

function excerptPreview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

type PipelineModel = { providerId: string; modelName: string };

/**
 * The model answering the conversation, and the small model of its side tasks (query translation, title).
 */
export async function getConversationModels(
  conversationId: string,
  { generation, retrieval }: Pick<PipelineParameters, "generation" | "retrieval">,
): Promise<{ generationModel: PipelineModel; smallModel: PipelineModel }> {
  // The conversation keeps the model it was started with; the pipeline model is only the default.
  const conversationModel = (await getConversationModel(conversationId))?.model;
  const generationModel = conversationModel
    ? { providerId: conversationModel.providerId, modelName: conversationModel.name }
    : { providerId: generation.providerId, modelName: generation.modelName };

  const { translation } = retrieval.hybrid;
  // No translation model set: the model answering the conversation, already loaded.
  const smallModel = translation.providerId && translation.modelName
    ? { providerId: translation.providerId, modelName: translation.modelName }
    : generationModel;

  return { generationModel, smallModel };
}

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
}): AsyncGenerator<ChatStreamEvent> {
  yield { type: "step", step: "ANALYZING" };

  const config = await pipelineRuntime.getConfig();
  const { chunking, embedding, retrieval, generation } = config.parameters;

  const { generationModel, smallModel: translationModel } = await getConversationModels(conversationId, config.parameters);

  const generationProvider = await getPipelineProvider(generationModel, "génération");
  const embeddingProvider = await getPipelineProvider(embedding, "embedding");

  const retriever = await getDocumentRetriever(
    embeddingProvider,
    embedding.modelName,
    embeddingContextLength(chunking.chunkSize),
  );

  // Same Unicode form as the indexed chunks, normalized after extraction.
  const query = message.normalize("NFC");

  // Different models: the translation runs while the query is embedded.
  const [queryEmbedding, translations, documentIds] = await Promise.all([
    retriever.embedQuery(query),
    usesLexicalSearch(retrieval.hybrid)
      ? getPipelineProvider(translationModel, "traduction").then((provider) => translateQuery(provider, translationModel.modelName, query))
      : untranslatedQuery(query),
    // Its project documents, or the library outside any project.
    getSearchableDocumentIds(conversationId),
  ]);

  yield { type: "step", step: "RETRIEVING" };

  const retrievedChunks = await retriever.search(queryEmbedding, {
    query,
    translations,
    retrieval,
    sparse: embedding.sparse,
    chunkSize: chunking.chunkSize,
    documentIds: documentIds ?? undefined,
  });

  const excerpts = buildExcerpts(retrievedChunks);

  // Sent before the answer so the sources show up while the model is still thinking.
  if (excerpts.length > 0) {
    yield {
      type: "sources",
      sources: excerpts.map(({ documentId, documentName, chunkId, chunkPage, text }) => ({
        documentId,
        documentName,
        chunkId,
        pageNumber: chunkPage,
        preview: excerptPreview(text),
      })),
    };
  }

  yield { type: "step", step: "BUILDING_CONTEXT" };

  const ragContext = buildRagContext(excerpts);

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

  // Covers the prompt reading and, when enabled, the model thinking: until the first token.
  yield { type: "step", step: "THINKING" };

  for await (const chunk of generationProvider.chat(chatInput)) {
    yield { type: "content", content: chunk.content };
  }
}