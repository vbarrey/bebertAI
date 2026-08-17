"use client";

import { MessageRole, MessageStatus } from "@prisma/client";

import { ChatMessage } from "@/types/chat";

import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

import { useState } from "react";

type ChatProps = {
  conversationId: string;
  messages: ChatMessage[];
  providersModels: {
    id: string;
    name: string;
    isDefault: boolean;
    defaultModelId: string | null;
    models: { name: string; id: string }[];
  }[];
};

export function Chat({ conversationId, messages, providersModels }: ChatProps) {
  const [chatMessages, setChatMessages] = useState(messages);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSendMessage = async (message: string, aiId: {providerId: string, modelId: string}) => {
    setIsStreaming(true);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: MessageRole.USER,
      content: message,
      status: MessageStatus.COMPLETED,
      createdAt: new Date(),
    };

    setChatMessages((prevMessages) => [...prevMessages, userMessage]);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: MessageRole.ASSISTANT,
      content: "",
      status: MessageStatus.PENDING,
      createdAt: new Date(),
    };

    setChatMessages((prevMessages) => [...prevMessages, assistantMessage]);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        message,
        providerId: aiId.providerId,
        modelId: aiId.modelId
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    let bufferedContent = "";
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      bufferedContent += decoder.decode(value, { stream: true });
      const lines = bufferedContent.split("\n");
      bufferedContent = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        try {
          const chunk = JSON.parse(line);
          setChatMessages((previous) => {
            const messages = [...previous];

            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              content: messages[messages.length - 1].content + chunk.content,
            };

            return messages;
          });
        } catch (error) {
          console.error("Error parsing chunk:", error);
        }
      }
    }

    setChatMessages((previous) => {
      const messages = [...previous];

      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        status: MessageStatus.COMPLETED,
      };

      return messages;
    });

    setIsStreaming(false);
  };

  return (
    <div>
      <MessageList messages={chatMessages} />
      <ChatInput
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        providersModels={providersModels}
      />
    </div>
  );
}
