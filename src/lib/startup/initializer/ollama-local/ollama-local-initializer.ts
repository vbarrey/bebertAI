import { prisma } from "@/lib/prisma";
import { AIProviderSource, AIProviderType } from "@prisma/client";
import { AIInitializer } from "../../AIInitializer";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { parseOllamaLocalConfig } from "@/lib/ai/ollama-local/config";
import { OllamaLocalProvider } from "@/lib/ai/ollama-local/provider";
import { syncProviderModels } from "@/lib/ai/provider-factory";

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
            host: process.env["OLLAMA_HOST"],
            defaultModel: process.env["OLLAMA_DEFAULT_MODEL"],
          },
          enabled: true,
          isDefault: true,
        },
      });
    }

    const config = parseOllamaLocalConfig(pProvider.configuration);

    const ollamaProvider = new OllamaLocalProvider(pProvider.id, pProvider.name, config);
    this.providerId = pProvider.id;

    aiProviderRegistry.register(ollamaProvider);
  }

  async synchronizeModels(): Promise<void> {
    if (!this.providerId || !aiProviderRegistry.has(this.providerId)) {
      throw new Error(
        "Can not init ollama models since runtime instance of default Ollama provider is undefined"
      );
    }

    // The same synchronization as the other providers: the default model is the one of its configuration,
    // set from OLLAMA_DEFAULT_MODEL when the provider was created.
    const provider = await prisma.aIProvider.findUniqueOrThrow({ where: { id: this.providerId } });
    await syncProviderModels(provider, aiProviderRegistry.get(this.providerId)!);
  }
}
