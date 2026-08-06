import { ChatChunk } from "@/lib/chat/type";

import { config } from "@/lib/config";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  model: string;
  messages: OllamaMessage[];
}

export async function* streamOllamaModel(
  options: StreamChatOptions
): AsyncGenerator<ChatChunk> {
  try {
    const res = await fetch(`${config.ollama.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        stream: true,
        messages: options.messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();

      console.error("Status:", res.status);
      console.error("Headers:", Object.fromEntries(res.headers.entries()));
      console.error("Body:", body);

      throw new Error(`Failed to stream chat: ${res.status} ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        try {
          const chunk = JSON.parse(line);
          if(chunk.message?.content)
            yield {delta: chunk.message.content};
        } catch (error) {
          console.error("Error parsing chunk:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching chat:", error);
    throw error;
  }
}
