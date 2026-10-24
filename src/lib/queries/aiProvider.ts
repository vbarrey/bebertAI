import { cache } from "react";
import { AIProviderType, type AIProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOllamaLocalDefaultModel } from "@/lib/ai/ollama-local/config";
import { isManageable, usableProviders } from "@/lib/ai/provider-access";

// These providers reach the browser: their API key is replaced, it only shows that a key is set.
function maskApiKey<T extends AIProvider>(provider: T): T {
  const configuration = provider.configuration;
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration) || !("apiKey" in configuration)) {
    return provider;
  }
  return { ...provider, configuration: { ...configuration, apiKey: "••••••••" } };
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
    models: provider.models.map((model) => ({
      ...model,
      isDefault: provider.type === AIProviderType.OLLAMA_LOCAL && isOllamaLocalDefaultModel(model.name),
    })),
  })));
});

export const getEnableProvidersWithModels = cache(async (userId: string) => {
  return prisma.aIProvider.findMany({
    where: { AND: [usableProviders(userId), { enabled: true, models: { some: {enabled: true}} }] },
    include: { models: { where: {enabled: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  }).then((providers) => providers.map(maskApiKey));
});
