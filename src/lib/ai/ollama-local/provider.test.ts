import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

import type { OllamaLocalProvider as Provider } from "./provider";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Read by the env module when it loads: set before importing the provider.
process.env.OLLAMA_URL = "http://ollama.test:11434/";
let OllamaLocalProvider: typeof Provider;
before(async () => { ({ OllamaLocalProvider } = await import("./provider")); });

// Answers with the given responses in turn, recording the requests.
function fakeFetch(...responses: { status: number; body: unknown }[]) {
    const requests: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
        requests.push({ url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : {} });
        const { status, body } = responses[Math.min(requests.length, responses.length) - 1]!;
        return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return requests;
}

describe("OllamaLocalProvider", () => {
    it("embeds on OLLAMA_URL without key, with the context length", async () => {
        const requests = fakeFetch({ status: 200, body: { embeddings: [[1], [2]] } });

        const embeddings = await new OllamaLocalProvider("id", "Ollama").embed({ model: "qwen3-embedding:4b-q8_0", input: ["a", "b"], contextLength: 2048 });

        assert.deepEqual(embeddings, [[1], [2]]);
        assert.equal(requests[0]!.url, "http://ollama.test:11434/api/embed");
        assert.equal(requests[0]!.headers.Authorization, undefined);
        assert.deepEqual(requests[0]!.body.options, { num_ctx: 2048 });
    });

    it("waits and retries when Windows ran out of local ports", async () => {
        const requests = fakeFetch(
            { status: 400, body: { error: "Post \"http://127.0.0.1:52455/tokenize\": dial tcp 127.0.0.1:52455: bind: An operation on a socket could not be performed" } },
            { status: 200, body: { embeddings: [[1]] } },
        );

        assert.deepEqual(await new OllamaLocalProvider("id", "Ollama", 0).embed({ model: "m", input: ["a"] }), [[1]]);
        assert.equal(requests.length, 2);
    });

    it("does not retry another error", async () => {
        const requests = fakeFetch({ status: 404, body: { error: "model \"m\" not found" } });

        await assert.rejects(new OllamaLocalProvider("id", "Ollama", 0).embed({ model: "m", input: ["a"] }), /not found/);
        assert.equal(requests.length, 1);
    });

    it("lists its models as free", async () => {
        fakeFetch({ status: 200, body: { models: [{ name: "qwen3-embedding:4b-q8_0", model: "qwen3-embedding:4b-q8_0", size: 1, details: { family: "qwen3", parameter_size: "4B" }, capabilities: ["embedding"] }] } });

        const [model] = await new OllamaLocalProvider("id", "Ollama").models();
        assert.equal(model!.requiresCredits, false);
        assert.deepEqual(model!.capabilities, ["EMBEDDING"]);
    });
});
