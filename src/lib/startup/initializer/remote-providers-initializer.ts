import { AIProvider, AIProviderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIInitializer } from "../AIInitializer";
import { AIProviderClient } from "@/lib/ai/provider";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { createProviderClient } from "@/lib/ai/provider-factory";

// Providers created from the settings, unlike Ollama local which comes from the .env.
const REMOTE_PROVIDER_TYPES: AIProviderType[] = [AIProviderType.OLLAMA_CLOUD];

/**
 * Stores the models listed by the provider, keeping the models already stored as they are.
 */
export async function syncProviderModels(provider: AIProvider, client: AIProviderClient): Promise<void> {
  const models = await client.models();
  const configuration = provider.configuration as { defaultModel?: string } | null;

  for (const model of models) {
    const pModel = await prisma.aIModel.upsert({
      where: { providerId_name: { providerId: provider.id, name: model.name } },
      create: { ...model, source: "REMOTE", providerId: provider.id },
      update: {},
    });

    if (configuration?.defaultModel === model.name) {
      await prisma.aIProvider.update({
        where: { id: provider.id },
        data: { defaultModelId: pModel.id },
      });
    }
  }
}

export class RemoteProvidersInitializer implements AIInitializer {
  name: string = "REMOTE PROVIDERS INIT";
  providers: AIProvider[] = [];

  async initializeProvider(): Promise<void> {
    this.providers = await prisma.aIProvider.findMany({
      where: { type: { in: REMOTE_PROVIDER_TYPES } },
    });

    for (const provider of this.providers) {
      aiProviderRegistry.register(createProviderClient(provider));
    }
  }

  async synchronizeModels(): Promise<void> {
    // One unreachable provider (or refused API key) does not keep the others from synchronizing.
    for (const provider of this.providers) {
      try {
        await syncProviderModels(provider, aiProviderRegistry.get(provider.id)!);
      } catch (error) {
        console.log(`Failed to synchronize models of provider "${provider.name}" : ${error}`);
      }
    }
  }
}
