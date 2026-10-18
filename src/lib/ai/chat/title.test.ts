import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AIProviderClient } from "@/lib/ai/provider";
import type { ChatRequestInput } from "@/lib/ai/types";
import { cleanTitle, generateTitle, provisionalTitle } from "./title";

function fakeProvider(answer: string | Error) {
    const requests: ChatRequestInput[] = [];
    const provider = {
        async *chat(input: ChatRequestInput) {
            requests.push(input);
            if (answer instanceof Error) throw answer;
            yield { role: "assistant" as const, content: answer };
        },
    } as unknown as AIProviderClient;

    return { provider, requests };
}

describe("provisionalTitle", () => {
    it("keeps a short message on one line", () => {
        assert.equal(provisionalTitle("  Quelle huile\npour la  Celtaquatre ? "), "Quelle huile pour la Celtaquatre ?");
    });

    it("cuts a long message on a word with an ellipsis", () => {
        const title = provisionalTitle("Donne moi toutes les références des pièces du pare-chocs arrière de la Renault Celtaquatre");
        assert.equal(title, "Donne moi toutes les références des pièces du…");
        assert.ok(title.length <= 50);
    });
});

describe("cleanTitle", () => {
    it("removes quotes, label, Markdown and final punctuation", () => {
        assert.equal(cleanTitle('Titre : « Pare-chocs de la Celtaquatre ».'), "Pare-chocs de la Celtaquatre");
        assert.equal(cleanTitle("## **Huile moteur Renault**"), "Huile moteur Renault");
        assert.equal(cleanTitle('"Oil for the Celtaquatre"'), "Oil for the Celtaquatre");
    });

    it("keeps the first line after a reasoning block", () => {
        assert.equal(cleanTitle("<think>Le sujet est l'huile.</think>\n\nHuile de la Celtaquatre\nAutre ligne"), "Huile de la Celtaquatre");
    });

    it("returns null without a title", () => {
        assert.equal(cleanTitle(""), null);
        assert.equal(cleanTitle(" \n « » \n"), null);
    });
});

describe("generateTitle", () => {
    it("returns the cleaned title, asked without reasoning", async () => {
        const { provider, requests } = fakeProvider("« Référence 7.232.355 ».");

        assert.equal(await generateTitle(provider, "small", "Référence 7.232.355 ?", "C'est un pare-chocs."), "Référence 7.232.355");
        assert.equal(requests[0]?.modelName, "small");
        assert.equal(requests[0]?.think, false);
    });

    it("returns null when the model fails", async () => {
        const { provider } = fakeProvider(new Error("offline"));

        assert.equal(await generateTitle(provider, "small", "Question", "Réponse"), null);
    });
});
