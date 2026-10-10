import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Chunk } from "@prisma/client";

import type { AIProviderClient } from "@/lib/ai/provider";
import { DocumentEmbedder, embeddingContextLength, type EmbeddingCache } from "./embedder";

const chunk = (id: string, text: string) => ({ id, documentId: "doc", text }) as Chunk;

// Embeds a text as [its length], recording each request.
function fakeProvider(failOnCall?: number) {
    const requests: string[][] = [];
    const provider = {
        embed: async ({ input }: { input: string[] }) => {
            requests.push(input);
            if (requests.length === failOnCall) throw new Error("Ollama indisponible");
            return input.map((text) => [text.length]);
        },
    } as unknown as AIProviderClient;

    return { provider, requests };
}

function memoryCache(): EmbeddingCache & { store: Map<string, number[]> } {
    const store = new Map<string, number[]>();

    return {
        store,
        get: async (keys) => new Map(keys.flatMap((key) => (store.has(key) ? [[key, store.get(key)!] as const] : []))),
        set: async (entries) => { entries.forEach((value, key) => store.set(key, value)); },
    };
}

const texts = (count: number) => Array.from({ length: count }, (_, index) => chunk(`c${index}`, "x".repeat(index + 1)));

describe("DocumentEmbedder", () => {
    it("embeds in batches of 32 and keeps the chunk order", async () => {
        const { provider, requests } = fakeProvider();
        const chunks = texts(70);

        const embeddings = await new DocumentEmbedder(provider, "model", { cache: memoryCache() }).embed(chunks);

        assert.deepEqual(requests.map((batch) => batch.length).sort(), [32, 32, 6].sort());
        assert.deepEqual(embeddings.map((e) => e.chunkId), chunks.map((c) => c.id));
        assert.deepEqual(embeddings.map((e) => e.embedding[0]), chunks.map((c) => c.text.length));
    });

    it("reuses the cached vectors of unchanged texts", async () => {
        const cache = memoryCache();
        await new DocumentEmbedder(fakeProvider().provider, "model", { cache }).embed(texts(5));

        const { provider, requests } = fakeProvider();
        const chunks = [...texts(5), chunk("new", "un texte modifié")];
        const embeddings = await new DocumentEmbedder(provider, "model", { cache }).embed(chunks);

        assert.deepEqual(requests, [["un texte modifié"]]);
        assert.equal(embeddings.length, 6);
    });

    it("does not reuse vectors of another model", async () => {
        const cache = memoryCache();
        await new DocumentEmbedder(fakeProvider().provider, "model-a", { cache }).embed(texts(3));

        const { provider, requests } = fakeProvider();
        await new DocumentEmbedder(provider, "model-b", { cache }).embed(texts(3));

        assert.equal(requests.flat().length, 3);
    });

    it("embeds a repeated text once", async () => {
        const { provider, requests } = fakeProvider();
        const embeddings = await new DocumentEmbedder(provider, "model", { cache: memoryCache() })
            .embed([chunk("a", "En-tête"), chunk("b", "Corps"), chunk("c", "En-tête")]);

        assert.deepEqual(requests.flat().sort(), ["Corps", "En-tête"]);
        assert.deepEqual(embeddings.map((e) => e.chunkId), ["a", "b", "c"]);
    });

    it("reports progress up to the number of distinct texts, cached ones first", async () => {
        const cache = memoryCache();
        await new DocumentEmbedder(fakeProvider().provider, "model", { cache }).embed(texts(10));

        const progress: [number, number][] = [];
        await new DocumentEmbedder(fakeProvider().provider, "model", { cache })
            .embed(texts(45), (current, total) => { progress.push([current, total]); });

        assert.deepEqual(progress[0], [10, 45]);
        assert.deepEqual(progress.at(-1), [45, 45]);
    });

    it("keeps the batches embedded before a failure for the retry", async () => {
        const cache = memoryCache();
        // Second request fails: with 4 batches in flight, the first one is cached.
        await assert.rejects(
            new DocumentEmbedder(fakeProvider(2).provider, "model", { cache }).embed(texts(40)),
            /Ollama indisponible/,
        );

        assert.ok(cache.store.size >= 32);
    });
});

describe("embeddingContextLength", () => {
    it("fits the largest chunk, rounded up to 1024 tokens", () => {
        assert.equal(embeddingContextLength(300), 1024);
        assert.equal(embeddingContextLength(2000), 2048);
        assert.equal(embeddingContextLength(2048), 2048);
        assert.equal(embeddingContextLength(2049), 3072);
    });
});
