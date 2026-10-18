import { ChatMessage } from "@/types/chat";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { Chat } from "./Chat";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { prisma } from "@/lib/prisma";

type ChatPanelProps = {
  conversationId: string;
  title: string | null;
  messages: ChatMessage[];
  model: { providerId: string; name: string } | null;
};

export async function ChatPanel({ conversationId, title, messages, model }: ChatPanelProps) {

  const [providersModels, pipelineConfig, indexedDocuments] = await Promise.all([
    getEnableProvidersWithModels(),
    pipelineRuntime.getConfig(),
    prisma.document.count({ where: { indexingStatus: "PROCESSED" } }),
  ]);

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
