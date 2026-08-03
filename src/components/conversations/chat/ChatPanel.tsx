import { Message } from "@prisma/client";

import { EmptyConversation } from "./EmptyConversation";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

type MessageList = Omit<Message, "conversationId" | "updatedAt">[];

type ChatPanelProps = {
  conversationId: string;
  projectId: string;
  messages: MessageList;
};

export async function ChatPanel({ conversationId, messages, projectId }: ChatPanelProps) {
  if (messages.length === 0) {
    return (
      <div>
        <EmptyConversation conversationId={conversationId} />
      </div>
    );
  } else {
    return (
      <div className="flex flex-1 flex-col gap-4 justify-between h-full">
        <MessageList messages={messages} />
        <ChatInput conversationId={conversationId} projectId={projectId}/>
      </div>
    );
  }
}
