import { Embedder } from "../embedder";
import { OllamaProvider } from "@/lib/ai/ollama/provider";

export class OllamaEmbedder implements Embedder {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly model: string,
  ) {}

  async embed(chunks: string[]): Promise<number[][]> {
    if (chunks.length === 0) {
      return [];
    }

    return this.provider.embed({ model: this.model, chunks });
  }
}
