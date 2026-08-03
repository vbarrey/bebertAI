import { ChatInput } from "./ChatInput";

type Props = {
    conversationId: string;
};

export async function EmptyConversation({ conversationId }: Props) {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <ChatInput conversationId={conversationId} />
    </div>
  );
}
