import {
  OllamaChatRequest,
  OllamaModel,
  OllamaChatChunk,
  OllamaChatResponse,
} from "./types";
import { config } from "@/lib/config";

import {
  OllamaError,
  OllamaConnectionError,
  OllamaRequestError,
  OllamaEmptyBodyResponseError,
} from "./errors";

async function* chat(
  input: OllamaChatRequest
): AsyncGenerator<OllamaChatChunk> {
  const res = await request(() =>
    fetch(`${config.ollama.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );

  if (!res.body) {
    throw new OllamaEmptyBodyResponseError();
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk: OllamaChatResponse = JSON.parse(line);
      if (chunk.message.content === "") continue;
      yield {
        created_at: chunk.created_at,
        model: chunk.model,
        message: { role: "assistant", content: chunk.message.content },
        done: chunk.done,
      };
    }
  }
}

async function models(): Promise<OllamaModel[]> {
  const res = await request(() =>
    fetch(`${config.ollama.host}/api/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
  );

  const data = await res.json();
  return data.models;
}

function pull(): Promise<never> {
  throw new Error("Function not implemented.");
}

function remove(): Promise<never> {
  throw new Error("Function not implemented.");
}

async function request(call: () => Promise<Response>): Promise<Response> {
  try {
    const res = await call();

    if (!res.ok) {
      throw new OllamaRequestError(res.status, res.statusText);
    }

    return res;
  } catch (error) {
    // If the error is an instance of OllamaError, rethrow it
    if (error instanceof OllamaError) {
      throw error;
    }

    throw new OllamaConnectionError({ cause: error });
  }
}

export const ollamaClient = {
  chat,
  models,
  pull,
  remove,
};
