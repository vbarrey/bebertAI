"use client";

import { MessageRole, MessageStatus } from "@prisma/client";

import { ChatMessage } from "@/types/chat";
import type { ChatStreamEvent } from "@/lib/ai/types";

import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

import { useState } from "react";
import { Provider } from "@/types/augmented-prisma";

type ChatProps = {
  conversationId: string;
  messages: ChatMessage[];
  providersModels: Provider[];
  initialModel: { providerId: string; modelName: string };
};

export function Chat({ conversationId, messages, providersModels, initialModel }: ChatProps) {
  const [chatMessages, setChatMessages] = useState(messages);
  const [isStreaming, setIsStreaming] = useState(false);

  async function handleSendMessage(message: string){
    setIsStreaming(true);
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
  };

  return (
    <div>
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
