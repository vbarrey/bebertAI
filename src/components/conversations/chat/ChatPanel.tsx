import { ChatMessage } from "@/types/chat";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { Chat } from "./Chat";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

type ChatPanelProps = {
  conversationId: string;
  projectId: string;
  messages: ChatMessage[];
  model: { providerId: string; name: string } | null;
};

export async function ChatPanel({ conversationId, messages, model }: ChatPanelProps) {

  const providersModels = await getEnableProvidersWithModels();
  const pipelineConfig = await pipelineRuntime.getConfig();

  return (
    <div className="flex flex-1 flex-col gap-4 justify-between h-full">
      <Chat
        conversationId={conversationId}
        messages={messages}
        providersModels={providersModels}
        initialModel={model
          ? { providerId: model.providerId, modelName: model.name }
          : pipelineConfig.parameters.generation}
      />
    </div>
  );
}
