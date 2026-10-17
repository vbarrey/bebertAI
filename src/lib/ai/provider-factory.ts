import { AIProvider, AIProviderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIProviderClient } from "./provider";
import { aiProviderRegistry } from "./registry";
import { OllamaLocalProvider } from "./ollama-local/provider";
import { parseOllamaLocalConfig } from "./ollama-local/config";
import { OllamaCloudProvider } from "./ollama-cloud/provider";
import { parseOllamaCloudConfig } from "./ollama-cloud/config";
import { AnthropicProvider } from "./anthropic/provider";
import { parseAnthropicConfig } from "./anthropic/config";
import { VoyageProvider } from "./voyage/provider";
import { parseVoyageConfig } from "./voyage/config";

export function createProviderClient(provider: AIProvider): AIProviderClient {
  switch (provider.type) {
    case AIProviderType.OLLAMA_LOCAL:
      return new OllamaLocalProvider(provider.id, provider.name, parseOllamaLocalConfig(provider.configuration));
    case AIProviderType.OLLAMA_CLOUD:
      return new OllamaCloudProvider(provider.id, provider.name, parseOllamaCloudConfig(provider.configuration));
    case AIProviderType.ANTHROPIC:
      return new AnthropicProvider(provider.id, provider.name, parseAnthropicConfig(provider.configuration));
    case AIProviderType.VOYAGE:
      return new VoyageProvider(provider.id, provider.name, parseVoyageConfig(provider.configuration));
    default:
      throw new Error(`Type de fournisseur non supporté : ${provider.type}`);
  }
}

/**
 * Stores the models listed by the provider, keeping the models already stored as they are,
 * with whether they need usage credits when the provider tells (one request per model).
 */
export async function syncProviderModels(provider: AIProvider, client: AIProviderClient): Promise<void> {
  const models = await client.models();
  const requiresCredits = client.requiresCredits
    ? await checkModelsAccess(client.requiresCredits.bind(client), models.map((model) => model.name))
    : [];
  const source = provider.type === AIProviderType.OLLAMA_LOCAL ? "LOCAL" : "REMOTE";
  const configuration = provider.configuration as { defaultModel?: string } | null;

  for (const [index, model] of models.entries()) {
    // An unknown answer (rate limited...) keeps what the last synchronization found.
    const access = requiresCredits[index] === undefined ? {} : { requiresCredits: requiresCredits[index] };

    const pModel = await prisma.aIModel.upsert({
      where: { providerId_name: { providerId: provider.id, name: model.name } },
      create: { ...model, ...access, source, providerId: provider.id },
      update: access,
    });

    if (configuration?.defaultModel === model.name) {
      await prisma.aIProvider.update({
        where: { id: provider.id },
        data: { defaultModelId: pModel.id },
      });
    }
  }
}

// Ollama Cloud refuses too many concurrent requests (429) on the free plan: 4 pass.
const ACCESS_CHECK_CONCURRENCY = 3;

async function checkModelsAccess(
  requiresCredits: (modelName: string) => Promise<boolean | undefined>,
  modelNames: string[],
): Promise<(boolean | undefined)[]> {
  const results: (boolean | undefined)[] = [];
  let next = 0;
  const worker = async () => {
    while (next < modelNames.length) {
      const index = next++;
      results[index] = await requiresCredits(modelNames[index]);
    }
  };
  await Promise.all(Array.from({ length: ACCESS_CHECK_CONCURRENCY }, worker));
  return results;
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
