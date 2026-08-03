import { Message } from "@prisma/client";

import { MessageBuble } from "./MessageBuble";

type MessageList = Omit<Message, "conversationId" | "updatedAt">[];

import { ScrollArea } from "@/components/ui/scroll-area"

type MessageListProps = {
  messages: MessageList;
};

export async function MessageList({ messages }: MessageListProps) {
  return (
    <ScrollArea className="h-[calc(100vh-240px)]">
      {messages.map((message) => (
        <MessageBuble key={message.id} message={message} />
      ))}
    </ScrollArea>
  );
}
