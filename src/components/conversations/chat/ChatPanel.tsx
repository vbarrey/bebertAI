import { ChatMessage } from "@/types/chat";
import { getProvidersWithModels } from "@/lib/queries/aiProvider";
import { Chat } from "./Chat";

type ChatPanelProps = {
  conversationId: string;
  projectId: string;
  messages: ChatMessage[];
};

export async function ChatPanel({ conversationId, messages, projectId }: ChatPanelProps) {

  const providersModels = await getProvidersWithModels();

  return (
    <div className="flex flex-1 flex-col gap-4 justify-between h-full">
      <Chat conversationId={conversationId} messages={messages} providersModels={providersModels}/>
    </div>
  );
}
