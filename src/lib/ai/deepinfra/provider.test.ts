import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DeepInfraProvider } from "./provider";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function fakeFetch(status: number, body: unknown) {
    const urls: string[] = [];
    globalThis.fetch = (async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return urls;
}

describe("DeepInfraProvider", () => {
    const provider = new DeepInfraProvider("id", "DeepInfra", { apiKey: "secret" });

    it("embeds through the OpenAI-compatible API, in the input order", async () => {
        const urls = fakeFetch(200, { data: [{ embedding: [2], index: 1 }, { embedding: [1], index: 0 }] });

        assert.deepEqual(await provider.embed({ model: "Qwen/Qwen3-Embedding-4B", input: ["a", "b"] }), [[1], [2]]);
        assert.equal(urls[0], "https://api.deepinfra.com/v1/openai/embeddings");
    });

    it("offers the embedding model shared with Ollama only", async () => {
        assert.deepEqual((await provider.models()).map(({ name }) => name), ["Qwen/Qwen3-Embedding-4B"]);
    });

    it("explains a refused API key and refuses to chat", async () => {
        fakeFetch(401, { detail: { error: "invalid key" } });
        await assert.rejects(provider.checkApiKey(), /Clé API DeepInfra refusée/);

        await assert.rejects(provider.chat().next(), /Seuls les modèles d'embedding/);
    });
});
