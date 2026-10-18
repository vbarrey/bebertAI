import { ChatMessage } from "@/types/chat";

import { MessageRole, MessageStatus } from "@prisma/client";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Markdown } from "@/components/ui/markdown"
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatProgress } from "./ChatProgress";
import { ChatSources } from "./ChatSources";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {

  const bottomRef = useRef<HTMLDivElement>(null);
  // Whether the end of the conversation is on screen: the answer is followed only then.
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      atBottomRef.current = entry.isIntersecting;
      setAtBottom(entry.isIntersecting);
    });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  // Opens at the end of the conversation.
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // Before paint, so the observer never sees the end pushed off screen by the new tokens.
  useLayoutEffect(() => {
    if (messages.at(-1)?.role === "USER") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (atBottomRef.current) {
      // Instant: a smooth scroll lags behind the stream and loses the bottom.
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  return (
    <div className="relative mx-auto min-h-0 w-full max-w-4xl flex-1">
      <ScrollArea className="h-full">
        <div className="flex w-full flex-col gap-12 px-4 pt-12">
          {messages.map((message) => {
            switch (message.role) {
              case MessageRole.USER:
                return (
                  <Bubble variant="tinted" align="end" key={message.id}>
                    <BubbleContent className="text-base">{message.content}</BubbleContent>
                  </Bubble>
                );
              case MessageRole.ASSISTANT:
                if (message.status === MessageStatus.FAILED)
                  return (
                    <Bubble variant="destructive" align="start" key={message.id}>
                      <BubbleContent className="text-base">
                        {message.content && <Markdown content={message.content} />}
                        <p>La génération de la réponse a échoué.</p>
                      </BubbleContent>
                    </Bubble>
                  );
                return (
                  <Bubble variant="ghost" align="start" key={message.id}>
                    <BubbleContent className="text-base">
                      {/* Steps until the first words of the answer arrive. */}
                      {message.step && !message.content
                        ? <ChatProgress step={message.step} />
                        : <Markdown content={message.content} />}
                      {message.sources && <ChatSources sources={message.sources} />}
                    </BubbleContent>
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
          {/* After the last gap: the space under the last message, and what the observer watches. */}
          <div ref={bottomRef} className="h-px" />
        </div>
      </ScrollArea>

      {!atBottom && (
        <Button
          size="icon"
          variant="outline"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
          aria-label="Aller à la fin de la conversation"
        >
          <ArrowDown />
        </Button>
      )}
    </div>
  );
}
