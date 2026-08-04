import { ChatInput } from "./ChatInput";

type Props = {
    conversationId: string;
    projectId: string;
};

export async function EmptyConversation({ conversationId, projectId }: Props) {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <ChatInput conversationId={conversationId} projectId={projectId} />
    </div>
  );
}
