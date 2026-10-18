import { ChatMessage } from "@/types/chat";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { Chat } from "./Chat";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

type ChatPanelProps = {
  conversationId: string;
  projectId: string;
  title: string | null;
  messages: ChatMessage[];
  model: { providerId: string; name: string } | null;
};

export async function ChatPanel({ conversationId, projectId, title, messages, model }: ChatPanelProps) {

  const providersModels = await getEnableProvidersWithModels();
  const pipelineConfig = await pipelineRuntime.getConfig();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Chat
        conversationId={conversationId}
        projectId={projectId}
        title={title}
        messages={messages}
        providersModels={providersModels}
        initialModel={model
          ? { providerId: model.providerId, modelName: model.name }
          : pipelineConfig.parameters.generation}
      />
    </div>
  );
}
