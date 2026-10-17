import { cache } from "react";
import type { AIProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// These providers reach the browser: their API key is replaced, it only shows that a key is set.
function maskApiKey<T extends AIProvider>(provider: T): T {
  const configuration = provider.configuration;
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration) || !("apiKey" in configuration)) {
    return provider;
  }
  return { ...provider, configuration: { ...configuration, apiKey: "••••••••" } };
}

export const getProvidersWithModels = cache(async () => {
  return prisma.aIProvider.findMany({
    include: { models: { include: {capabilities: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  }).then((providers) => providers.map(maskApiKey));
});

export const getEnableProvidersWithModels = cache(async () => {
  return prisma.aIProvider.findMany({
    where: { enabled: true, models: { some: {enabled: true}} },
    include: { models: { where: {enabled: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  }).then((providers) => providers.map(maskApiKey));
});

export const getProviderConfiguration = cache(async (providerId: string) => {
  return await prisma.aIProvider.findUnique({select: {configuration: true}, where: {id: providerId}})
})
