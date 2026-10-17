import { AIProvider, AIProviderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIProviderClient } from "./provider";
import { aiProviderRegistry } from "./registry";
import { OllamaLocalProvider } from "./ollama-local/provider";
import { parseOllamaLocalConfig } from "./ollama-local/config";
import { OllamaCloudProvider } from "./ollama-cloud/provider";
import { parseOllamaCloudConfig } from "./ollama-cloud/config";

export function createProviderClient(provider: AIProvider): AIProviderClient {
  switch (provider.type) {
    case AIProviderType.OLLAMA_LOCAL:
      return new OllamaLocalProvider(provider.id, provider.name, parseOllamaLocalConfig(provider.configuration));
    case AIProviderType.OLLAMA_CLOUD:
      return new OllamaCloudProvider(provider.id, provider.name, parseOllamaCloudConfig(provider.configuration));
    default:
      throw new Error(`Type de fournisseur non supporté : ${provider.type}`);
  }
}

/**
 * Registers a provider stored in database but missing from this process registry:
 * the indexing worker has its own registry, filled at its start only.
 */
export async function loadProvider(id: string): Promise<AIProviderClient | undefined> {
  const provider = await prisma.aIProvider.findUnique({ where: { id } });
  if (!provider) return undefined;

  const client = createProviderClient(provider);
  aiProviderRegistry.register(client);
  return client;
}
