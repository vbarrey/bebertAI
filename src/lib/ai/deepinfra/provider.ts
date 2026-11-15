import { Capability } from "@prisma/client";

import { AIModelInfo, ChatChunk, Embedding, EmbedRequest } from "../types";
import { AIProviderClient } from "../provider";
import { ProviderError } from "../errors";

// DeepInfra's OpenAI-compatible API. Fixed: a user cannot make the server call another address.
const DEEPINFRA_HOST = "https://api.deepinfra.com/v1/openai";

// The embedding model also served by Ollama (qwen3-embedding:4b-q8_0): documents indexed on a machine with Ollama
// can be searched here (measured with npm run eval:compat). DeepInfra lists hundreds of models: only this one is offered.
const DEEPINFRA_MODELS: AIModelInfo[] = [
  { name: "Qwen/Qwen3-Embedding-4B", displayName: "Qwen3 Embedding 4B", family: "qwen3", parameterSize: "4B", capabilities: [Capability.EMBEDDING], requiresCredits: true },
];

const RATE_LIMIT_RETRIES = 6;

export type DeepInfraConfiguration = { apiKey: string; defaultModel?: string };

export function parseDeepInfraConfig(config: unknown): DeepInfraConfiguration {
  const { apiKey, defaultModel } = (config ?? {}) as Record<string, unknown>;
  if (typeof apiKey !== "string" || !apiKey || (defaultModel != null && typeof defaultModel !== "string")) {
    throw new Error("Invalid DeepInfra configuration");
  }
  return { apiKey, defaultModel: defaultModel ?? undefined };
}

export class DeepInfraError extends ProviderError {
  constructor(message: string, options?: ErrorOptions) {
    super(`[DEEPINFRA] ${message}`, options);
    this.name = "DeepInfraError";
  }
}

export class DeepInfraProvider implements AIProviderClient {
  constructor(public id: string, public name: string, private config: DeepInfraConfiguration) {}

  async models(): Promise<AIModelInfo[]> {
    return DEEPINFRA_MODELS;
  }

  async *chat(): AsyncGenerator<ChatChunk> {
    throw new DeepInfraError("Seuls les modèles d'embedding de DeepInfra sont proposés. Choisissez un autre fournisseur pour la génération.");
  }

  async embed(input: EmbedRequest): Promise<Embedding[]> {
    const { data } = await this.request<{ data: { embedding: number[]; index: number }[] }>("/embeddings", {
      model: input.model,
      input: input.input,
      encoding_format: "float",
    });
    return data.sort((a, b) => a.index - b.index).map(({ embedding }) => embedding);
  }

  // A two-letter embedding: a fraction of a cent.
  async checkApiKey(): Promise<void> {
    await this.embed({ model: DEEPINFRA_MODELS[0]!.name, input: ["ok"] });
  }

  async updateConfig(config: unknown): Promise<void> {
    this.config = parseDeepInfraConfig(config);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${DEEPINFRA_HOST}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new DeepInfraError("Impossible de joindre l'API DeepInfra.", { cause: error });
      }

      if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new DeepInfraError("Clé API DeepInfra refusée.");
      }
      if (res.status === 402) {
        throw new DeepInfraError("Crédit DeepInfra épuisé : ajoutez un moyen de paiement sur deepinfra.com.");
      }
      if (!res.ok) {
        const detail = await res.json().then((json) => json?.detail?.error ?? json?.detail ?? json?.error?.message).catch(() => null);
        throw new DeepInfraError(`(STATUS ${res.status}) ${typeof detail === "string" ? detail : res.statusText}`);
      }

      return res.json();
    }
  }
}
