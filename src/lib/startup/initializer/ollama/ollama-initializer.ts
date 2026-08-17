import { prisma } from "@/lib/prisma";
import { AIProviderType } from "@prisma/client";
import { AIInitializer } from "../../AIInitializer";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { parseOllamaConfig } from "@/lib/ai/ollama/config";
import { OllamaProvider } from "@/lib/ai/ollama/provider";

export class OllamaInitializer implements AIInitializer {
  name: string = "OLLAMA LOCAL INIT";
  providerId: string | undefined;

  async initializeProvider(): Promise<void> {
    let pProvider = await prisma.aIProvider.findFirst({
      where: {
        type: AIProviderType.OLLAMA,
      },
    });

    if (!pProvider) {
      pProvider = await prisma.aIProvider.create({
        data: {
          type: AIProviderType.OLLAMA,
          name: "OLLAMA LOCAL",
          configuration: {
            host: process.env["OLLAMA_HOST"],
            defaultModel: process.env["OLLAMA_DEFAULT_MODEL"],
          },
          enabled: true,
          isDefault: true,
        },
      });
    }

    const config = parseOllamaConfig(pProvider.configuration);

    const ollamaProvider = new OllamaProvider(pProvider.id, pProvider.name, config);
    this.providerId = pProvider.id;

    aiProviderRegistry.register(ollamaProvider);
  }

  async synchronizeModels(): Promise<void> {
    if (!this.providerId || !aiProviderRegistry.has(this.providerId)) {
      throw new Error(
        "Can not init ollama models since runtime instance of default Ollama provider is undefined"
      );
    }

    const ollamaProviderClient = aiProviderRegistry.get(this.providerId)!;
    const models = await ollamaProviderClient.models();

    if (!models) {
      console.log(
        "No models found from Ollama. Skipping model synchronization."
      );
      return; // TODO : Add fallback (There should be at least one model)
    }

    const ollamaProvider = await prisma.aIProvider.findFirst({
      where: {
        type: AIProviderType.OLLAMA,
      },
    });

    if (!ollamaProvider) {
      console.error(
        "Ollama provider not found in database. Cannot synchronize models."
      );
      return; // TODO : Add fallback (Ollama provider should exist)
    }

    for (const model of models) {
      let pModel = await prisma.aIModel.findFirst({
        where: {
          name: model.name,
          provider: {
            type: AIProviderType.OLLAMA,
          },
        },
      });

      if (!pModel) {
        pModel = await prisma.aIModel.create({
          data: { ...model, source: "LOCAL", providerId: ollamaProvider.id },
        });
      }

      if (process.env["OLLAMA_DEFAULT_MODEL"] === model.name) {
        await prisma.aIProvider.update({
          where: { id: ollamaProvider.id },
          data: {
            defaultModelId: pModel.id,
          },
          include: { defaultModel: true },
        });
      }
    }
  }
}
