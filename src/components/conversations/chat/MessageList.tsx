import { ChatMessage } from "@/types/chat";

import { MessageBuble } from "./MessageBuble";

import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useRef } from "react";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  return (
    <ScrollArea className="h-[calc(100vh-240px)]">
      {messages.map((message) => (
        <MessageBuble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
