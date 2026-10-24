import { AIProviderType, type Prisma } from "@prisma/client";

import { decryptToken, encryptToken } from "@/lib/encryption";

type User = { id: string; role?: string | null };

// Ollama local: one provider for every user, created from the .env.
const SHARED: Prisma.AIProviderWhereInput = { type: AIProviderType.OLLAMA_LOCAL, userId: null };

/** The providers a user can use: their own, and the shared Ollama local. */
export function usableProviders(userId: string): Prisma.AIProviderWhereInput {
  return { OR: [{ userId }, SHARED] };
}

/** The providers a user can change: their own; the shared Ollama local too for the admin. */
export function manageableProviders(user: User): Prisma.AIProviderWhereInput {
  return user.role === "admin" ? { OR: [{ userId: user.id }, SHARED] } : { userId: user.id };
}

export function isManageable(provider: { userId: string | null; type: AIProviderType }, user: User) {
  return provider.userId === user.id || (user.role === "admin" && provider.userId === null && provider.type === AIProviderType.OLLAMA_LOCAL);
}

// Marks an encrypted API key: the keys stored before the encryption are encrypted at start-up.
const ENCRYPTED = "enc:";

type WithApiKey = { apiKey?: unknown };

/** The configuration to store: its API key encrypted. */
export function encryptApiKey<T extends WithApiKey>(configuration: T): T {
  const { apiKey } = configuration;
  return typeof apiKey === "string" && !apiKey.startsWith(ENCRYPTED)
    ? { ...configuration, apiKey: ENCRYPTED + encryptToken(apiKey) }
    : configuration;
}

/** The configuration a client is created with: its API key decrypted. */
export function decryptApiKey(configuration: Prisma.JsonValue): Prisma.JsonValue {
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration)) return configuration;

  const { apiKey } = configuration;
  return typeof apiKey === "string" && apiKey.startsWith(ENCRYPTED)
    ? { ...configuration, apiKey: decryptToken(apiKey.slice(ENCRYPTED.length)) }
    : configuration;
}

/** True for a configuration whose API key is still stored in clear. */
export function hasClearApiKey(configuration: Prisma.JsonValue) {
  return typeof configuration === "object" && configuration !== null && !Array.isArray(configuration)
    && typeof configuration.apiKey === "string" && !configuration.apiKey.startsWith(ENCRYPTED);
}
