"use client";

import { MessageRole, MessageStatus } from "@prisma/client";

import { ChatMessage } from "@/types/chat";
import type { ChatStreamEvent } from "@/lib/ai/types";

import { generateConversationTitle } from "@/lib/mutations/conversation";
import { provisionalTitle } from "@/lib/ai/chat/title";

import { ChatInput } from "./ChatInput";
import { ConversationTitle } from "./ConversationTitle";
import { MessageList } from "./MessageList";

import { useState } from "react";
import { Provider } from "@/types/augmented-prisma";

type ChatProps = {
  conversationId: string;
  projectId: string;
  title: string | null;
  messages: ChatMessage[];
  providersModels: Provider[];
  initialModel: { providerId: string; modelName: string };
};

export function Chat({ conversationId, projectId, title: initialTitle, messages, providersModels, initialModel }: ChatProps) {
  const [chatMessages, setChatMessages] = useState(messages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [title, setTitle] = useState(initialTitle);

  async function handleSendMessage(message: string){
    setIsStreaming(true);

    const isFirstExchange = chatMessages.length === 0;
    // Same as the server sets: shown right away, a title given by hand stays.
    if (title === null) setTitle(provisionalTitle(message));

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: MessageRole.USER,
      content: message,
      status: MessageStatus.COMPLETED,
      createdAt: new Date(),
    };

    setChatMessages((prevMessages) => [...prevMessages, userMessage]);

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: MessageRole.ASSISTANT,
      content: "",
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      step: "ANALYZING",
    };

    setChatMessages((prevMessages) => [...prevMessages, assistantMessage]);

    let status: MessageStatus = MessageStatus.FAILED;

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
            setChatMessages((previous) => {
              const messages = [...previous];
              const last = messages[messages.length - 1];

              messages[messages.length - 1] =
                event.type === "step" ? { ...last, step: event.step }
                : event.type === "sources" ? { ...last, sources: event.sources }
                : { ...last, content: last.content + event.content };

              return messages;
            });
          } catch (error) {
            console.error("Error parsing chunk:", error);
          }
        }
      }

      status = MessageStatus.COMPLETED;
    } catch (error) {
      console.error("Chat streaming failed:", error);
    } finally {
      setChatMessages((previous) => {
        const messages = [...previous];

        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          status,
        };

        return messages;
      });

      setIsStreaming(false);
    }

    // After the first answer, without holding the input: the small model titles the conversation.
    if (isFirstExchange && status === MessageStatus.COMPLETED) {
      generateConversationTitle(conversationId)
        .then((generated) => generated && setTitle(generated))
        .catch((error) => console.warn("Conversation title generation failed:", error));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationTitle
        conversationId={conversationId}
        projectId={projectId}
        title={title}
        onRename={setTitle}
      />
      <MessageList messages={chatMessages} />
      <ChatInput
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        providersModels={providersModels}
        initialModel={initialModel}
        modelLocked={chatMessages.length > 0}
      />
    </div>
  );
}
