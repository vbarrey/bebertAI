"use client";

import { MessageRole, MessageStatus } from "@prisma/client";
import { toast } from "sonner";

import { ChatMessage } from "@/types/chat";
import type { ChatStreamEvent } from "@/lib/ai/types";

import { generateConversationTitle, removeLastExchange } from "@/lib/mutations/conversation";
import { provisionalTitle } from "@/lib/ai/chat/title";

import { ChatInput } from "./ChatInput";
import { ConversationTitle } from "./ConversationTitle";
import { MessageList } from "./MessageList";

import { useRef, useState } from "react";
import { Provider } from "@/types/augmented-prisma";

type ChatProps = {
  conversationId: string;
  projectId: string;
  title: string | null;
  messages: ChatMessage[];
  providersModels: Provider[];
  initialModel: { providerId: string; modelName: string };
  // No document indexed: the answers have no source to rely on.
  hasIndexedDocuments: boolean;
};

export function Chat({ conversationId, projectId, title: initialTitle, messages, providersModels, initialModel, hasIndexedDocuments }: ChatProps) {
  const [chatMessages, setChatMessages] = useState(messages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  // Stops the answer being generated: the request is aborted and the server keeps the answer as far as it went.
  const abortRef = useRef<AbortController | null>(null);

  function updateLastMessage(update: (message: ChatMessage) => ChatMessage) {
    setChatMessages((previous) => [...previous.slice(0, -1), update(previous[previous.length - 1])]);
  }

  // Asks the question after the given messages: the current ones, or fewer when an answer is asked again.
  async function send(message: string, previousMessages: ChatMessage[]) {
    setIsStreaming(true);

    const isFirstExchange = previousMessages.length === 0;
    // Same as the server sets: shown right away, a title given by hand stays.
    if (title === null) setTitle(provisionalTitle(message));

    setChatMessages([
      ...previousMessages,
      {
        id: crypto.randomUUID(),
        role: MessageRole.USER,
        content: message,
        status: MessageStatus.COMPLETED,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        role: MessageRole.ASSISTANT,
        content: "",
        status: MessageStatus.PENDING,
        createdAt: new Date(),
        step: "ANALYZING",
      },
    ]);

    const abort = new AbortController();
    abortRef.current = abort;

    let status: MessageStatus = MessageStatus.FAILED;
    let error: string | undefined;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message
        }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let bufferedContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bufferedContent += decoder.decode(value, { stream: true });
        const lines = bufferedContent.split("\n");
        bufferedContent = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            const event: ChatStreamEvent = JSON.parse(line);

            if (event.type === "error") {
              error = event.message;
              continue;
            }

            updateLastMessage((last) =>
              event.type === "step" ? { ...last, step: event.step }
              : event.type === "sources" ? { ...last, sources: event.sources }
              : { ...last, content: last.content + event.content });
          } catch (error) {
            console.error("Error parsing chunk:", error);
          }
        }
      }

      if (!error) status = MessageStatus.COMPLETED;
    } catch (caught) {
      if (abort.signal.aborted) {
        status = MessageStatus.CANCELLED;
      } else {
        console.error("Chat streaming failed:", caught);
        error = "Le serveur ne répond pas : vérifiez que l'application est démarrée.";
      }
    } finally {
      abortRef.current = null;
      updateLastMessage((last) => ({ ...last, status, error }));
      setIsStreaming(false);
    }

    // After the first answer, without holding the input: the small model titles the conversation.
    if (isFirstExchange && status === MessageStatus.COMPLETED) {
      generateConversationTitle(conversationId)
        .then((generated) => generated && setTitle(generated))
        .catch((error) => console.warn("Conversation title generation failed:", error));
    }
  };

  // Regenerate or retry: the last question is asked again in place of the last exchange.
  async function askAgain() {
    try {
      const question = await removeLastExchange(conversationId);
      if (question === null) return;
      send(question, chatMessages.slice(0, -2));
    } catch {
      toast.error("Impossible de relancer la question.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationTitle
        conversationId={conversationId}
        projectId={projectId}
        title={title}
        onRename={setTitle}
      />
      <MessageList
        messages={chatMessages}
        isStreaming={isStreaming}
        hasIndexedDocuments={hasIndexedDocuments}
        onAskAgain={askAgain}
      />
      <ChatInput
        conversationId={conversationId}
        onSendMessage={(message) => send(message, chatMessages)}
        onStop={() => abortRef.current?.abort()}
        isStreaming={isStreaming}
        providersModels={providersModels}
        initialModel={initialModel}
        modelLocked={chatMessages.length > 0}
      />
    </div>
  );
}
