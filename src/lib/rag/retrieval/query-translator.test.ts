import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AIProviderClient } from "@/lib/ai/provider";
import type { ChatRequestInput } from "@/lib/ai/types";
import { translateQuery } from "./query-translator";

const QUERY = "Quelle huile pour la Celtaquatre ?";

// Streams the answer in two chunks, like Ollama, and records the request.
function fakeProvider(answer: string | Error) {
    const requests: ChatRequestInput[] = [];
    const provider = {
        async *chat(input: ChatRequestInput) {
            requests.push(input);
            if (answer instanceof Error) throw answer;
            const middle = Math.floor(answer.length / 2);
            yield { role: "assistant" as const, content: answer.slice(0, middle) };
            yield { role: "assistant" as const, content: answer.slice(middle) };
        },
    } as unknown as AIProviderClient;

    return { provider, requests };
}

describe("translateQuery", () => {
    it("returns one translation per BM25 language", async () => {
        const translations = {
            french: QUERY,
            english: "Which oil for the Celtaquatre?",
            russian: "Какое масло для Celtaquatre?",
            german: "Welches Öl für die Celtaquatre?",
        };
        const { provider } = fakeProvider(JSON.stringify(translations));

        assert.deepEqual(await translateQuery(provider, "model", QUERY), translations);
    });

    it("asks for a deterministic JSON answer without reasoning", async () => {
        const { provider, requests } = fakeProvider("{}");
        await translateQuery(provider, "model", QUERY);

        const [request] = requests;
        assert.equal(request?.temperature, 0);
        assert.equal(request?.think, false);
        assert.deepEqual(request?.format?.required, ["french", "english", "russian", "german"]);
        assert.equal(request?.messages.at(-1)?.content, QUERY);
    });

    it("keeps the query for a missing or empty translation", async () => {
        const { provider } = fakeProvider(JSON.stringify({ english: "Which oil?", german: "  " }));

        assert.deepEqual(await translateQuery(provider, "model", QUERY), {
            french: QUERY,
            english: "Which oil?",
            russian: QUERY,
            german: QUERY,
        });
    });

    it("keeps the query in every language when the answer is not JSON or the model fails", async () => {
        for (const answer of ["Voici la traduction : ...", "", new Error("model not found")]) {
            const { provider } = fakeProvider(answer);

            assert.deepEqual(await translateQuery(provider, "model", QUERY), {
                french: QUERY,
                english: QUERY,
                russian: QUERY,
                german: QUERY,
            });
        }
    });

    it("returns NFC translations", async () => {
        const { provider } = fakeProvider(JSON.stringify({ german: "Welches Öl?".normalize("NFD") }));

        assert.equal((await translateQuery(provider, "model", QUERY)).german, "Welches Öl?".normalize("NFC"));
    });
});
