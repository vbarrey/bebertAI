import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bm25Document, SPARSE_VECTOR_NAMES, sparseVectorName } from "./bm25";

const sparse = { k: 1.2, b: 0.75, asciiFolding: true };

describe("bm25", () => {
    it("names one sparse vector per language and one without stemmer", () => {
        assert.deepEqual(SPARSE_VECTOR_NAMES, ["bm25_french", "bm25_english", "bm25_russian", "bm25_german", "bm25_none"]);
        assert.equal(sparseVectorName("german"), "bm25_german");
        assert.equal(sparseVectorName(null), "bm25_none");
    });

    it("builds the options of a language from the pipeline parameters", () => {
        assert.deepEqual(bm25Document("Le moteur", "french", sparse, 2000), {
            text: "Le moteur",
            model: "qdrant/bm25",
            options: { k: 1.2, b: 0.75, avg_len: 125, ascii_folding: true, language: "french" },
        });
    });

    it("disables the stemmer and the default English stopwords for an unknown language", () => {
        assert.deepEqual(bm25Document("IMG 2041", null, sparse, 2000).options, {
            k: 1.2,
            b: 0.75,
            avg_len: 125,
            ascii_folding: true,
            stemmer: { type: "none" },
            stopwords: { languages: [], custom: [] },
        });
    });

    it("keeps avg_len positive for tiny chunks", () => {
        assert.equal(bm25Document("x", "english", sparse, 5).options.avg_len, 1);
    });
});
