import { prisma } from "@/lib/prisma";
import { AIProviderSource, AIProviderType } from "@prisma/client";
import { AIInitializer } from "../../AIInitializer";
import { createProviderClient, syncProviderModels } from "@/lib/ai/provider-factory";
import { env } from "@/lib/env";

export class OllamaLocalInitializer implements AIInitializer {
  name: string = "OLLAMA LOCAL INIT";
  providerId: string | undefined;

  async initializeProvider(): Promise<void> {
    // The shared one, without owner.
    let pProvider = await prisma.aIProvider.findFirst({
      where: {
        type: AIProviderType.OLLAMA_LOCAL,
        userId: null,
      },
    });

    if (!pProvider) {
      pProvider = await prisma.aIProvider.create({
        data: {
          type: AIProviderType.OLLAMA_LOCAL,
          source: AIProviderSource.LOCAL,
          name: "OLLAMA LOCAL",
          configuration: {
            host: env.OLLAMA_HOST,
            defaultModel: env.OLLAMA_DEFAULT_MODEL,
          },
          enabled: true,
          isDefault: true,
        },
      });
    }

    this.providerId = pProvider.id;
  }

  async synchronizeModels(): Promise<void> {
    if (!this.providerId) {
      throw new Error("Can not init ollama models since the default Ollama provider is not created");
    }

    // The same synchronization as the other providers: the default model is the one of its configuration,
    // set from OLLAMA_DEFAULT_MODEL when the provider was created.
    const provider = await prisma.aIProvider.findUniqueOrThrow({ where: { id: this.providerId } });
    await syncProviderModels(provider, createProviderClient(provider));
  }
}
