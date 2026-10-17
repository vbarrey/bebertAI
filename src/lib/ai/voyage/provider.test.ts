import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { VoyageProvider } from "./provider";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Answers with the given responses in turn, recording the request bodies.
function fakeFetch(...responses: { status: number; body: unknown }[]) {
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        const { status, body } = responses[Math.min(bodies.length, responses.length) - 1]!;
        return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return bodies;
}

describe("VoyageProvider", () => {
    const provider = new VoyageProvider("id", "Voyage", { apiKey: "secret" });

    it("sends the input type and returns the embeddings in the input order", async () => {
        const bodies = fakeFetch({ status: 200, body: { data: [{ embedding: [2], index: 1 }, { embedding: [1], index: 0 }] } });

        const embeddings = await provider.embed({ model: "voyage-4", input: ["a", "b"], inputType: "document" });

        assert.deepEqual(embeddings, [[1], [2]]);
        assert.equal(bodies[0]!.input_type, "document");
    });

    it("waits and retries when rate limited", async () => {
        const bodies = fakeFetch(
            { status: 429, body: { detail: "rate limited" } },
            { status: 200, body: { data: [{ embedding: [1], index: 0 }] } },
        );

        assert.deepEqual(await provider.embed({ model: "voyage-4", input: ["a"] }), [[1]]);
        assert.equal(bodies.length, 2);
    });

    it("explains a refused API key and refuses to chat", async () => {
        fakeFetch({ status: 401, body: { detail: "Provided API key is invalid." } });
        await assert.rejects(provider.checkApiKey(), /Clé API Voyage refusée/);

        await assert.rejects(provider.chat().next(), /que des modèles d'embedding/);
    });
});
