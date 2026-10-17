import { Capability } from "@prisma/client";

// BebertAI types
import { AIModelInfo, ChatChunk, Embedding, EmbedRequest } from "../types";
import { AIProviderClient } from "../provider";
import { ProviderError } from "../errors";

import { GoogleConfiguration, parseGoogleConfig } from "./config";

const GEMINI_HOST = "https://generativelanguage.googleapis.com/v1beta";

// The Gemini embedding model: 8,192 tokens per text, 3,072 dimensions. Free on the free tier, where Google uses
// the data sent to improve its products.
const GOOGLE_MODELS: AIModelInfo[] = [
  { name: "gemini-embedding-2", displayName: "Gemini Embedding 2", family: "gemini-embedding", capabilities: [Capability.EMBEDDING], requiresCredits: false },
];

// The free tier allows few tokens per minute: waits the delay Google gives, up to about two minutes.
const RATE_LIMIT_RETRIES = 6;

export class GoogleError extends ProviderError {
  constructor(message: string, options?: ErrorOptions) {
    super(`[GOOGLE] ${message}`, options);
    this.name = "GoogleError";
  }
}

type GeminiError = {
  error?: {
    message?: string;
    details?: { "@type"?: string; reason?: string; retryDelay?: string }[];
  };
};

/**
 * gemini-embedding-2 has no task type: the task is a prefix of the text, a query searching documents and the
 * documents searched each with their own.
 */
export function toGeminiText(text: string, inputType: EmbedRequest["inputType"]): string {
  if (inputType === "query") return `task: search result | query: ${text}`;
  if (inputType === "document") return `title: none | text: ${text}`;
  return text;
}

export class GoogleProvider implements AIProviderClient {
  id: string;
  name: string;
  private config: GoogleConfiguration;

  constructor(id: string, name: string, config: GoogleConfiguration) {
    this.id = id;
    this.name = name ?? "GOOGLE";
    this.config = config;
  }

  async models(): Promise<AIModelInfo[]> {
    return GOOGLE_MODELS;
  }

  async hasModel(modelName: string): Promise<boolean> {
    return GOOGLE_MODELS.some((model) => model.name === modelName);
  }

  async *chat(): AsyncGenerator<ChatChunk> {
    throw new GoogleError("Seul l'embedding Gemini est disponible. Choisissez un autre fournisseur pour la génération.");
  }

  async embed(input: EmbedRequest): Promise<Embedding[]> {
    const response = await this.request<{ embeddings: { values: number[] }[] }>(
      `/models/${input.model}:batchEmbedContents`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: input.input.map((text) => ({
            model: `models/${input.model}`,
            content: { parts: [{ text: toGeminiText(text, input.inputType) }] },
          })),
        }),
      },
    );

    // In the order of the texts sent.
    return response.embeddings.map((embedding) => embedding.values);
  }

  // Reading the model needs the key and spends no token.
  async checkApiKey(): Promise<void> {
    await this.request("/models/gemini-embedding-2", { method: "GET" });
  }

  async updateConfig(config: unknown): Promise<void> {
    this.config = parseGoogleConfig(config);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${GEMINI_HOST}${path}`, {
          ...init,
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey },
        });
      } catch (error) {
        throw new GoogleError("Impossible de joindre l'API Gemini.", { cause: error });
      }

      if (res.ok) {
        return res.json();
      }

      const body: GeminiError = await res.json().catch(() => ({}));
      const details = body.error?.details ?? [];

      if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        // Google says how long to wait ("31s"); otherwise 1, 2, 4... s.
        const retryDelay = details.find((detail) => detail.retryDelay)?.retryDelay;
        const seconds = retryDelay ? parseFloat(retryDelay) : 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        continue;
      }

      // A wrong key is a 400 with this reason, a key without the Gemini API a 403.
      if (details.some((detail) => detail.reason === "API_KEY_INVALID") || res.status === 401 || res.status === 403) {
        throw new GoogleError("Clé API Google refusée.");
      }

      throw new GoogleError(`(STATUS ${res.status}) ${body.error?.message ?? res.statusText}`);
    }
  }
}
