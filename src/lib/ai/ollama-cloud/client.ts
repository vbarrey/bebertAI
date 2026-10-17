// Same API as Ollama local, behind a bearer API key.
import { OllamaChatRequest, OllamaModel, OllamaChatChunk, OllamaChatResponse } from "../ollama-local/types";
import {
  OllamaError,
  OllamaConnectionError,
  OllamaRequestError,
  OllamaEmptyBodyResponseError,
} from "../ollama-local/errors";
import { OllamaCloudConfiguration } from "./config";

export class OllamaCloudClient {
  constructor(private readonly config: OllamaCloudConfiguration) {}

  async *chat(input: OllamaChatRequest): AsyncGenerator<OllamaChatChunk> {
    const res = await this.request("/api/chat", {
      method: "POST",
      body: JSON.stringify(input),
    });

    if (!res.body) {
      throw new OllamaEmptyBodyResponseError();
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let hasContent = false;
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk: OllamaChatResponse = JSON.parse(line);
        if (chunk.done && !hasContent && !chunk.message.content) {
          throw new OllamaError(
            chunk.done_reason === "length"
              ? `Réponse vide : la limite de ${chunk.eval_count} tokens a été atteinte avant la réponse (réflexion du modèle ?). Augmentez le nombre maximal de tokens ou désactivez la réflexion dans Paramètres > Pipeline.`
              : `Réponse vide du modèle (done_reason: ${chunk.done_reason}).`,
          );
        }
        if (chunk.message.content === "") continue;
        hasContent = true;
        yield {
          created_at: chunk.created_at,
          model: chunk.model,
          message: { role: "assistant", content: chunk.message.content },
          done: chunk.done,
        };
      }
    }
  }

  async models(): Promise<OllamaModel[]> {
    const res = await this.request("/api/tags", { method: "GET" });

    const data = await res.json();
    return data.models;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.config.host}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
    } catch (error) {
      throw new OllamaConnectionError({ cause: error });
    }

    if (res.status === 401) {
      throw new OllamaError("Clé API Ollama Cloud refusée. Vérifiez-la dans Paramètres > Fournisseurs.");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new OllamaRequestError(res.status, body?.error ?? res.statusText);
    }

    return res;
  }
}
