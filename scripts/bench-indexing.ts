/**
 * Times the two slow steps of the indexing on real documents: the OCR of a scanned PDF and the embedding.
 *
 * Usage: npm run bench:indexing -- [--pdf "PR 312"] [--embedded "PR 236"]
 *
 * --pdf: start of the name of a scanned PDF, extracted with OCR like the worker does (pages in parallel).
 * --embedded: start of the name of an indexed document whose chunks are embedded, without then with the cache.
 * Read-only: the embedding cache is kept in memory, nothing is written to the database or Qdrant.
 */
import type { Chunk } from "@prisma/client";

import { OllamaLocalProvider } from "@/lib/ai/ollama-local/provider";
import { withDocumentFile } from "@/lib/documents/storage";
import { prisma } from "@/lib/prisma";
import { PipelineParametersSchema } from "@/lib/pipeline/parameters";
import { DocumentEmbedder, embeddingContextLength, type EmbeddingCache } from "@/lib/rag/embedding/embedder";
import { PdfExtractor } from "@/lib/rag/indexing/extractors/pdf-extractor";

function argument(name: string, fallback: string): string {
    const index = process.argv.indexOf(`--${name}`);

    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await run();

    console.log(`${label.padEnd(56)} ${((performance.now() - start) / 1000).toFixed(2).padStart(7)} s`);

    return result;
}

function memoryCache(): EmbeddingCache {
    const store = new Map<string, number[]>();

    return {
        get: async (keys) => new Map(keys.flatMap((key) => (store.has(key) ? [[key, store.get(key)!] as const] : []))),
        set: async (entries) => { entries.forEach((embedding, key) => store.set(key, embedding)); },
    };
}

async function main() {
    const parameters = PipelineParametersSchema.parse(
        JSON.parse((await prisma.pipelineParameters.findUniqueOrThrow({ where: { id: 1 } })).parameters),
    );

    // OCR: every page under the native text threshold is rendered and recognized.
    const scan = await prisma.document.findFirstOrThrow({ where: { displayName: { startsWith: argument("pdf", "PR 312") } } });
    const extraction = { ...parameters.extraction, ocrEnabled: true };
    let pages = 0;

    await timed(`OCR « ${scan.displayName.slice(0, 30)} » (${extraction.ocrLanguages.join("+")})`, () =>
        withDocumentFile(scan, (filePath) =>
            new PdfExtractor(extraction).extract(filePath, scan, (_, total) => { pages = total; })));
    console.log(`  ${pages} pages OCR`);

    // Embedding: the model is loaded first so the timing is the embedding alone.
    const provider = new OllamaLocalProvider("ollama", "Ollama", { host: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434", defaultModel: "" });
    const contextLength = embeddingContextLength(parameters.chunking.chunkSize);
    const document = await prisma.document.findFirstOrThrow({
        where: { displayName: { startsWith: argument("embedded", "PR 236") } },
        include: { chunks: true },
    });
    const embedder = new DocumentEmbedder(provider, parameters.embedding.modelName, { contextLength, cache: memoryCache() });

    await timed(`chargement de ${parameters.embedding.modelName}`, () =>
        provider.embed({ model: parameters.embedding.modelName, input: ["warm-up"], contextLength }));
    await timed(`embedding de ${document.chunks.length} chunks`, () => embedder.embed(document.chunks as Chunk[]));
    await timed(`embedding de ${document.chunks.length} chunks, depuis le cache`, () => embedder.embed(document.chunks as Chunk[]));
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
