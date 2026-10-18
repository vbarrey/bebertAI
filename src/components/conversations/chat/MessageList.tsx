import Link from "next/link";
import { ChatMessage } from "@/types/chat";

import { MessageRole, MessageStatus } from "@prisma/client";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Markdown } from "@/components/ui/markdown"
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatProgress } from "./ChatProgress";
import { AnswerMarkdown, ChatSources } from "./ChatSources";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Check, Copy, MessageSquareText, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type MessageListProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  hasIndexedDocuments: boolean;
  // Asks the last question again in place of its answer.
  onAskAgain: () => void;
};

const COPIED_FEEDBACK_MS = 1500;

export function MessageList({ messages, isStreaming, hasIndexedDocuments, onAskAgain }: MessageListProps) {

  const bottomRef = useRef<HTMLDivElement>(null);
  // Whether the end of the conversation is on screen: the answer is followed only then.
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // The list mounts with the first message: the empty conversation has no end to watch.
  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (isEmpty) return;
    const observer = new IntersectionObserver(([entry]) => {
      atBottomRef.current = entry.isIntersecting;
      setAtBottom(entry.isIntersecting);
    });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [isEmpty]);

  // Before paint, so the observer never sees the end pushed off screen by the new tokens.
  useLayoutEffect(() => {
    if (messages.at(-1)?.role === "USER") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (atBottomRef.current) {
      // Instant: a smooth scroll lags behind the stream and loses the bottom. Also opens at the end.
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  async function copy(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), COPIED_FEEDBACK_MS);
  }

  if (isEmpty) {
    return <EmptyConversation hasIndexedDocuments={hasIndexedDocuments} />;
  }

  return (
    <div className="relative mx-auto min-h-0 w-full max-w-4xl flex-1">
      <ScrollArea className="h-full">
        <div className="flex w-full flex-col gap-12 px-4 pt-12">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;

            switch (message.role) {
              case MessageRole.USER:
                return (
                  <Bubble variant="tinted" align="end" key={message.id}>
                    <BubbleContent className="text-base whitespace-pre-wrap">{message.content}</BubbleContent>
                  </Bubble>
                );
              case MessageRole.ASSISTANT:
                if (message.status === MessageStatus.FAILED)
                  return (
                    <Bubble variant="destructive" align="start" key={message.id}>
                      <BubbleContent className="text-base">
                        {message.content && <Markdown content={message.content} />}
                        <p className="flex items-start gap-2">
                          <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden />
                          {/* The cause is only known while the page is open: a saved failure has no message. */}
                          {message.error ?? "La génération de la réponse a échoué."}
                        </p>
                        {isLast && !isStreaming && (
                          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={onAskAgain}>
                            <RotateCcw className="size-3.5" />
                            Réessayer
                          </Button>
                        )}
                      </BubbleContent>
                    </Bubble>
                  );

                const isDone = message.status === MessageStatus.COMPLETED || message.status === MessageStatus.CANCELLED;

                return (
                  <Bubble variant="ghost" align="start" key={message.id}>
                    <BubbleContent className="text-base">
                      {/* Steps until the first words of the answer arrive. */}
                      {message.step && !message.content && message.status === MessageStatus.PENDING
                        ? <ChatProgress step={message.step} />
                        : <AnswerMarkdown content={message.content} sources={message.sources} />}

                      {message.status === MessageStatus.CANCELLED && (
                        <p className="text-sm italic text-muted-foreground">Réponse interrompue.</p>
                      )}

                      {message.sources && <ChatSources sources={message.sources} />}

                      {isDone && (
                        <div className="mt-2 -ml-2 flex items-center gap-1 text-muted-foreground">
                          {message.content && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => copy(message)}
                              aria-label={copiedId === message.id ? "Réponse copiée" : "Copier la réponse"}
                              title="Copier"
                            >
                              {copiedId === message.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </Button>
                          )}

                          {isLast && !isStreaming && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={onAskAgain}
                              aria-label="Régénérer la réponse"
                              title="Régénérer"
                            >
                              <RefreshCw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
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

function EmptyConversation({ hasIndexedDocuments }: { hasIndexedDocuments: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <MessageSquareText className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-lg font-medium">Posez une question sur vos documents</p>
      <p className="text-sm text-muted-foreground">
        Les réponses s&apos;appuient sur les extraits les plus pertinents de vos documents indexés, cités en sources.
      </p>

      {!hasIndexedDocuments && (
        <p className="mt-2 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-left text-sm text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Aucun document n&apos;est indexé : les réponses ne pourront s&apos;appuyer sur aucune source.{" "}
            <Link href="/documents" className="font-medium underline underline-offset-2">Importer des documents</Link>
          </span>
        </p>
      )}
    </div>
  );
}
