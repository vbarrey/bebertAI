import { ChatMessage } from "@/types/chat";

import { MessageRole } from "@prisma/client";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Markdown } from "@/components/ui/markdown"
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if(messages.at(-1)?.role === "USER")
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  setTimeout(()=>{bottomRef.current?.scrollIntoView({behavior: "smooth"})}, 500);

  return (
    <ScrollArea className="w-full max-w-4xl m-auto h-[calc(100vh-240px)]" >
      <div className="flex w-full flex-col gap-12 p-4 py-12">
        {messages.map((message) => {
          switch (message.role) {
            case MessageRole.USER:
              return (
                <Bubble variant="tinted" align="end" key={message.id}>
                  <BubbleContent className="text-base">{message.content}</BubbleContent>
                </Bubble>
              );
            case MessageRole.ASSISTANT:
              return (
                <Bubble variant="ghost" align="start" key={message.id}>
                  <BubbleContent className="text-base"><Markdown content={message.content} /></BubbleContent>
                </Bubble>
              );
            default:
              return (
                <Bubble variant="destructive" align="start" key={message.id}>
                  <BubbleContent className="text-base">{message.content}</BubbleContent>
                </Bubble>
              );
          }
        }
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
