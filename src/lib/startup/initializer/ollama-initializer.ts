import { prisma } from "@/lib/prisma";
import { AIProviderType } from "@prisma/client";
import { IAIProvider } from "../IAIProvider";
import { ollamaProviderClient } from "@/lib/ai/ollama/provider";

export class OllamaInitializer implements IAIProvider {

  name: string = "Ollama";

  async initializeProviders(): Promise<void> {
    const exists = await prisma.aIProvider.findFirst({
      where: {
        type: AIProviderType.OLLAMA,
      },
    });

    if (!exists) {
      await prisma.aIProvider.create({
        data: {
          type: AIProviderType.OLLAMA,
          name: "Ollama",
          enabled: true,
          isDefault: true,
        },
      });
    }
  }

  async synchronizeModels(): Promise<void> {
    const models = await ollamaProviderClient.models();

    if (!models){
      console.log("No models found from Ollama. Skipping model synchronization.");
      return; // TODO : Handle error (There should be at least one model)
    } 

    const ollamaProvider = await prisma.aIProvider.findFirst({
      where: {
        type: AIProviderType.OLLAMA,
      },
    });

    if (!ollamaProvider){
      console.error("Ollama provider not found in database. Cannot synchronize models.");
      return; // TODO : Handle error (Ollama provider should exist)
    }

    for (let model of models) {
      const exists = await prisma.aIModel.findFirst({
        where: {
          name: model.name,
          provider: {
            type: AIProviderType.OLLAMA,
          },
        },
      });

      if (!exists) {
        prisma.aIModel.create({
          data: {...model, source: "LOCAL", providerId: ollamaProvider.id},
        });
      }
    }
  }
}
