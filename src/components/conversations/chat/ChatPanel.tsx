import { ChatMessage } from "@/types/chat";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { Chat } from "./Chat";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { prisma } from "@/lib/prisma";
import { documentScopeWhere, getConversationScope } from "@/lib/rag/retrieval/document-scope";

type ChatPanelProps = {
  conversationId: string;
  // The signed-in user, owner of the conversation: the models offered are theirs and the shared ones.
  userId: string;
  title: string | null;
  messages: ChatMessage[];
  model: { providerId: string; name: string } | null;
};

export async function ChatPanel({ conversationId, userId, title, messages, model }: ChatPanelProps) {

  const [providersModels, pipelineConfig, scope] = await Promise.all([
    getEnableProvidersWithModels(userId),
    pipelineRuntime.getConfig(userId),
    getConversationScope(conversationId),
  ]);
  // In the documents the conversation searches.
  const indexedDocuments = scope
    ? await prisma.document.count({ where: { AND: [documentScopeWhere(scope), { indexingStatus: "PROCESSED" }] } })
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Chat
        conversationId={conversationId}
        title={title}
        messages={messages}
        providersModels={providersModels}
        hasIndexedDocuments={indexedDocuments > 0}
        initialModel={model
          ? { providerId: model.providerId, modelName: model.name }
          : pipelineConfig.parameters.generation}
      />
    </div>
  );
}
