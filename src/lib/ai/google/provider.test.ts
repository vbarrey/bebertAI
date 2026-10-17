import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { GoogleProvider } from "./provider";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Answers with the given responses in turn, recording the request bodies.
function fakeFetch(...responses: { status: number; body: unknown }[]) {
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
        bodies.push(init.body ? JSON.parse(init.body as string) : {});
        const { status, body } = responses[Math.min(bodies.length, responses.length) - 1]!;
        return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return bodies;
}

type Requests = { requests: { content: { parts: { text: string }[] } }[] };

describe("GoogleProvider", () => {
    const provider = new GoogleProvider("id", "Google", { apiKey: "secret" });

    it("prefixes queries and documents with their task, and returns one embedding per text", async () => {
        const bodies = fakeFetch(
            { status: 200, body: { embeddings: [{ values: [1] }, { values: [2] }] } },
            { status: 200, body: { embeddings: [{ values: [3] }] } },
        );

        assert.deepEqual(await provider.embed({ model: "gemini-embedding-2", input: ["a", "b"], inputType: "document" }), [[1], [2]]);
        assert.deepEqual(await provider.embed({ model: "gemini-embedding-2", input: ["q"], inputType: "query" }), [[3]]);

        const texts = (bodies as Requests[]).map((body) => body.requests.map((request) => request.content.parts[0]!.text));
        assert.deepEqual(texts, [["title: none | text: a", "title: none | text: b"], ["task: search result | query: q"]]);
    });

    it("waits the delay Google gives when rate limited", async () => {
        const bodies = fakeFetch(
            { status: 429, body: { error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "0.01s" }] } } },
            { status: 200, body: { embeddings: [{ values: [1] }] } },
        );

        assert.deepEqual(await provider.embed({ model: "gemini-embedding-2", input: ["a"] }), [[1]]);
        assert.equal(bodies.length, 2);
    });

    it("explains a refused API key and refuses to chat", async () => {
        fakeFetch({ status: 400, body: { error: { message: "API key not valid.", details: [{ reason: "API_KEY_INVALID" }] } } });
        await assert.rejects(provider.checkApiKey(), /Clé API Google refusée/);

        await assert.rejects(provider.chat().next(), /Seul l'embedding Gemini/);
    });
});
