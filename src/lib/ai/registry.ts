import { AIProviderClient } from "./provider";

const globalForAI = globalThis as unknown as {
  aiProviderRegistry: AIProviderRegistry | undefined;
};

class AIProviderRegistry {

  private providers = new Map<string, AIProviderClient>();

  get(id: string) {
    return this.providers.get(id);
  }

  has(id: string) {
    return this.providers.has(id);
  }

  register(provider: AIProviderClient): string {
    this.providers.set(provider.id, provider); // Should replace with id instead of name
    return provider.name;
  }

  async reload(id: string, config: unknown): Promise<void> {
    if (this.providers.has(id)) {
      await this.providers.get(id)!.updateConfig(config);
    } else {
      throw new Error(`Provider "${id}" is not registered`);
    }
  }

  remove(id: string): void {
    if (!this.providers.delete(id)) {
      throw new Error(`Provider "${id}" is not registered`);
    }
  }

  getProviderIdList(): string[] {
    return Array.from(this.providers.keys());
  }

  getNbProvider(): number {
    return this.providers.size;
  }
}

export const aiProviderRegistry =
  globalForAI.aiProviderRegistry ?? new AIProviderRegistry();

if (process.env.NODE_ENV !== "production") {
  globalForAI.aiProviderRegistry = aiProviderRegistry;
}
