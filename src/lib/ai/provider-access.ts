// Never in a browser bundle: importing it from a Client Component fails the build.
import "server-only";

import { type Prisma } from "@prisma/client";

import { decryptToken, encryptToken } from "@/lib/encryption";

type User = { id: string; role?: string | null };

/** The providers a user can use: their own, with their API keys. */
export function usableProviders(userId: string): Prisma.AIProviderWhereInput {
  return { userId };
}

/** The providers a user can change: their own, the admin included. */
export function manageableProviders(user: User): Prisma.AIProviderWhereInput {
  return { userId: user.id };
}

export function isManageable(provider: { userId: string }, user: User) {
  return provider.userId === user.id;
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
