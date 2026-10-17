import { Capability } from "@prisma/client";

// BebertAI types
import { AIModelInfo, ChatChunk, Embedding, EmbedRequest } from "../types";
import { AIProviderClient } from "../provider";
import { ProviderError } from "../errors";

import { VoyageConfiguration, parseVoyageConfig } from "./config";

const VOYAGE_HOST = "https://api.voyageai.com";

// Voyage has no API listing its models: its general purpose text models, paid once their 200M free tokens are used.
const VOYAGE_MODELS: AIModelInfo[] = [
  { name: "voyage-4-large", displayName: "Voyage 4 Large", family: "voyage-4", capabilities: [Capability.EMBEDDING], requiresCredits: true },
  { name: "voyage-4", displayName: "Voyage 4", family: "voyage-4", capabilities: [Capability.EMBEDDING], requiresCredits: true },
  { name: "voyage-4-lite", displayName: "Voyage 4 Lite", family: "voyage-4", capabilities: [Capability.EMBEDDING], requiresCredits: true },
];

// Voyage advises an exponential backoff on 429: 1, 2, 4... 32 s, for the low limits of an account without payment method.
const RATE_LIMIT_RETRIES = 6;

export class VoyageError extends ProviderError {
  constructor(message: string, options?: ErrorOptions) {
    super(`[VOYAGE] ${message}`, options);
    this.name = "VoyageError";
  }
}

type VoyageEmbedResponse = {
  data: { embedding: number[]; index: number }[];
};

export class VoyageProvider implements AIProviderClient {
  id: string;
  name: string;
  private config: VoyageConfiguration;

  constructor(id: string, name: string, config: VoyageConfiguration) {
    this.id = id;
    this.name = name ?? "VOYAGE";
    this.config = config;
  }

  async models(): Promise<AIModelInfo[]> {
    return VOYAGE_MODELS;
  }

  async hasModel(modelName: string): Promise<boolean> {
    return VOYAGE_MODELS.some((model) => model.name === modelName);
  }

  async *chat(): AsyncGenerator<ChatChunk> {
    throw new VoyageError("Voyage ne propose que des modèles d'embedding. Choisissez un autre fournisseur pour la génération.");
  }

  async embed(input: EmbedRequest): Promise<Embedding[]> {
    const response: VoyageEmbedResponse = await this.request("/v1/embeddings", {
      model: input.model,
      input: input.input,
      // Voyage embeds a query and a document differently, each with its own prompt.
      input_type: input.inputType ?? null,
    });

    return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }

  // No free endpoint needs the key: a two-letter embedding, a few of the free tokens.
  async checkApiKey(): Promise<void> {
    await this.embed({ model: "voyage-4-lite", input: ["ok"] });
  }

  async updateConfig(config: unknown): Promise<void> {
    this.config = parseVoyageConfig(config);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${VOYAGE_HOST}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new VoyageError("Impossible de joindre l'API Voyage.", { cause: error });
      }

      if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        continue;
      }

      if (res.status === 401) {
        throw new VoyageError("Clé API Voyage refusée.");
      }

      if (!res.ok) {
        // Voyage puts the cause in "detail".
        const detail = await res.json().then((json) => json?.detail).catch(() => null);
        throw new VoyageError(`(STATUS ${res.status}) ${detail ?? res.statusText}`);
      }

      return res.json();
    }
  }
}
