import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { latinizeLookalikes, normalizeExtractedText } from "./text";

describe("latinizeLookalikes", () => {
    it("writes OCR part numbers and models in Latin", () => {
        assert.equal(latinizeLookalikes("Х.7.232.355 Н0 В0 Т-54"), "X.7.232.355 H0 B0 T-54");
        // "la" read as digit one + Cyrillic а.
        assert.equal(latinizeLookalikes("de 1а pièce"), "de 1a pièce");
    });

    it("keeps Russian words, with or without digits", () => {
        const russian = "Пулемёт 37-мм и 1,5-тонного грузовика на шасси";

        assert.equal(latinizeLookalikes(russian), russian);
    });

    it("keeps Cyrillic words without digits or Latin letters", () => {
        // Only lookalikes, but nothing Latin around them: a Russian word (сухо, "dry").
        assert.equal(latinizeLookalikes("сухо и тепло"), "сухо и тепло");
    });
});

describe("normalizeExtractedText", () => {
    it("composes accents and latinizes lookalikes", () => {
        assert.equal(normalizeExtractedText("Contre-lame d’écartement Х.7.232.355".normalize("NFD")), "Contre-lame d’écartement X.7.232.355");
    });
});
