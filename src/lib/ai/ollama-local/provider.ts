import { env } from "@/lib/env";

import { AIModelInfo, Embedding, EmbedRequest } from "../types";
import { OllamaCloudProvider } from "../ollama-cloud/provider";
import { OllamaError, OllamaRequestError } from "../ollama-cloud/errors";

// On Windows, Ollama runs out of local ports after a few thousand texts in a row ("bind: An operation on a socket
// could not be performed because the system lacked sufficient buffer space"): the closed ones are freed after a while.
const PORTS_EXHAUSTED_RETRIES = 5;
const PORTS_EXHAUSTED_WAIT_MS = 30_000;

/**
 * Ollama on the machine of OLLAMA_URL: the same API as Ollama Cloud, without key, free, with the embedding models.
 * The address comes from the environment, never from the user: a user cannot make the server call another one.
 */
export class OllamaLocalProvider extends OllamaCloudProvider {
  constructor(id: string, name: string, private readonly retryWaitMs = PORTS_EXHAUSTED_WAIT_MS) {
    if (!env.OLLAMA_URL) {
      throw new OllamaError("Ollama local n'est pas disponible sur ce serveur (OLLAMA_URL n'est pas défini).");
    }
    super(id, name ?? "OLLAMA LOCAL", { host: env.OLLAMA_URL.replace(/\/$/, ""), apiKey: "" });
  }

  async models(): Promise<AIModelInfo[]> {
    // Run on this machine: free.
    return (await super.models()).map((model) => ({ ...model, requiresCredits: false }));
  }

  // No key: reachable is enough.
  async checkApiKey(): Promise<void> {
    await this.client.models();
  }

  async requiresCredits(): Promise<boolean> {
    return false;
  }

  async updateConfig(): Promise<void> {}

  async embed(input: EmbedRequest): Promise<Embedding[]> {
    const request = {
      model: input.model,
      input: input.input,
      ...(input.contextLength ? { options: { num_ctx: input.contextLength } } : {}),
    };

    for (let attempt = 1; ; attempt++) {
      try {
        return (await this.client.embed(request)).embeddings;
      } catch (error) {
        const portsExhausted = error instanceof OllamaRequestError && error.detail.includes("bind:");
        if (!portsExhausted || attempt >= PORTS_EXHAUSTED_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, this.retryWaitMs));
      }
    }
  }
}
