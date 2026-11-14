import { cache } from "react";
import { type AIProvider, type Capability, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptApiKey, isManageable, usableProviders } from "@/lib/ai/provider-access";

// These providers reach the browser: their API key is replaced by its last 4 characters, enough to tell two keys
// apart, as the providers' own consoles show them.
function maskApiKey<T extends AIProvider>(provider: T): T {
  const configuration = provider.configuration;
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration) || !("apiKey" in configuration)) {
    return provider;
  }
  return { ...provider, configuration: { ...configuration, apiKey: maskedKey(configuration) } };
}

function maskedKey(configuration: Prisma.JsonValue): string {
  try {
    const { apiKey } = decryptApiKey(configuration) as { apiKey?: unknown };
    // A short key would be shown almost whole.
    if (typeof apiKey === "string" && apiKey.length >= 16) return `••••${apiKey.slice(-4)}`;
  } catch {
    // Encrypted with another key: only that a key is set.
  }
  return "••••••••";
}

/** For the settings: `manageable` when the user can change the provider and its models. */
export const getProvidersWithModels = cache(async (user: { id: string; role?: string | null }) => {
  return prisma.aIProvider.findMany({
    where: usableProviders(user.id),
    include: { models: { include: {capabilities: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  }).then((providers) => providers.map((provider) => ({
    ...maskApiKey(provider),
    manageable: isManageable(provider, user),
  })));
});

/** The enabled models able to do the step (an embedding model cannot answer, nor a chat model embed). */
export const getEnableProvidersWithModels = cache(async (userId: string, capability: Capability) => {
  const usable = { enabled: true, capabilities: { some: { name: capability } } };
  return prisma.aIProvider.findMany({
    where: { AND: [usableProviders(userId), { enabled: true, models: { some: usable } }] },
    include: { models: { where: usable } },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  }).then((providers) => providers.map(maskApiKey));
});
