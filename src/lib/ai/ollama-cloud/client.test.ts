import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { OllamaCloudClient } from "./client";
import { parseOllamaCloudConfig } from "./config";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Answers with the given body split in the given pieces, recording the request.
function fakeFetch(pieces: string[], status = 200) {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const body = new ReadableStream({
            start(controller) {
                pieces.forEach((piece) => controller.enqueue(new TextEncoder().encode(piece)));
                controller.close();
            },
        });
        return new Response(body, { status });
    }) as typeof fetch;
    return calls;
}

const line = (content: string, done = false) =>
    JSON.stringify({ model: "m", created_at: "", message: { role: "assistant", content }, done }) + "\n";

describe("OllamaCloudClient", () => {
    const client = new OllamaCloudClient(parseOllamaCloudConfig({ apiKey: "secret" }));

    it("sends the API key to ollama.com and streams the answer split across reads", async () => {
        const answer = line("Bon") + line("jour") + line("", true);
        const calls = fakeFetch([answer.slice(0, 30), answer.slice(30)]);

        const contents: string[] = [];
        for await (const chunk of client.chat({ model: "m", messages: [] })) contents.push(chunk.message.content);

        assert.deepEqual(contents, ["Bon", "jour"]);
        assert.equal(calls[0].url, "https://ollama.com/api/chat");
        assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer secret");
    });

    it("explains a refused API key", async () => {
        fakeFetch(['{"error":"unauthorized"}'], 401);
        await assert.rejects(client.models(), /Clé API Ollama Cloud refusée/);
    });

    it("checks the API key: refused on 401, accepted when only the missing model is refused", async () => {
        fakeFetch(['{"error":"Unauthorized"}'], 401);
        await assert.rejects(client.checkApiKey(), /Clé API Ollama Cloud refusée/);

        fakeFetch(['{"error":"model is required"}'], 400);
        await client.checkApiKey();
    });

    it("refuses a configuration without API key", () => {
        assert.throws(() => parseOllamaCloudConfig({ host: "https://ollama.com" }), /Invalid Ollama Cloud configuration/);
    });
});
