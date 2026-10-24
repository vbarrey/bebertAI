import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPipelineParameters } from "@/lib/pipeline/default";
import { buildHybridQuery } from "./hybrid-query";

const translations = {
    french: "huile du moteur",
    english: "engine oil",
    russian: "моторное масло",
    german: "Motoröl",
};

const input = (hybrid: Partial<typeof defaultPipelineParameters.retrieval.hybrid> = {}) => ({
    vector: [0.1, 0.2],
    query: "huile du moteur",
    translations,
    retrieval: {
        ...defaultPipelineParameters.retrieval,
        topK: 8,
        scoreThreshold: 0.6,
        hybrid: { ...defaultPipelineParameters.retrieval.hybrid, ...hybrid },
    },
    sparse: defaultPipelineParameters.embedding.sparse,
    chunkSize: 2000,
});

type Prefetch = {
    query: unknown;
    filter?: unknown;
    using?: string;
    limit?: number;
    score_threshold?: number;
    prefetch?: Prefetch[];
};

const prefetches = (body: ReturnType<typeof buildHybridQuery>) => body.prefetch as Prefetch[];

describe("buildHybridQuery", () => {
    it("fuses the semantic search with one lexical list by RRF", () => {
        const body = buildHybridQuery(input({ denseLimit: 30, sparseLimit: 15, rrfK: 40, sparseWeight: 0.5 }));
        const [dense, lexical] = prefetches(body);

        assert.deepEqual(dense, { query: [0.1, 0.2], limit: 30, score_threshold: 0.6 });
        assert.equal(lexical?.limit, 15);
        assert.deepEqual(body.query, { rrf: { k: 40, weights: [1, 0.5] } });
        assert.equal(body.limit, 8);
        assert.equal(body.with_payload, true);
    });

    it("searches each language with its translation and unknown languages with the query as typed", () => {
        const [, lexical] = prefetches(buildHybridQuery(input({ sparseLimit: 15 })));

        assert.deepEqual(
            lexical!.prefetch!.map((p) => [p.using, (p.query as { text: string }).text, p.limit]),
            [
                ["bm25_french", "huile du moteur", 15],
                ["bm25_english", "engine oil", 15],
                ["bm25_russian", "моторное масло", 15],
                ["bm25_german", "Motoröl", 15],
                ["bm25_none", "huile du moteur", 15],
            ],
        );
    });

    it("ranks the lexical list by the BM25 score of each chunk in its language", () => {
        const [, lexical] = prefetches(buildHybridQuery(input()));
        const scores = ["$score[0]", "$score[1]", "$score[2]", "$score[3]", "$score[4]"];

        assert.deepEqual(lexical!.query, {
            formula: { sum: scores },
            defaults: Object.fromEntries(scores.map((score) => [score, 0])),
        });
    });

    it("applies the semantic threshold to the dense prefetch only", () => {
        const body = buildHybridQuery(input());
        const [dense, lexical] = prefetches(body);

        assert.equal(body.score_threshold, undefined);
        assert.equal(dense?.score_threshold, 0.6);
        assert.equal(lexical?.score_threshold, undefined);
        assert.ok(lexical!.prefetch!.every((p) => p.score_threshold === undefined));
    });

    it("uses the BM25 options of the indexing for each language", () => {
        const [, lexical] = prefetches(buildHybridQuery(input()));
        const [french, , , , none] = lexical!.prefetch!;

        assert.deepEqual((french!.query as { options: unknown }).options, {
            k: 1.2, b: 0.75, avg_len: 125, ascii_folding: true, language: "french",
        });
        assert.deepEqual((none!.query as { options: { stemmer: unknown } }).options.stemmer, { type: "none" });
    });

    it("falls back to the semantic search alone when hybrid search is disabled or has no lexical weight", () => {
        for (const hybrid of [{ enabled: false }, { sparseWeight: 0 }]) {
            assert.deepEqual(buildHybridQuery(input(hybrid)), {
                query: [0.1, 0.2],
                limit: 8,
                score_threshold: 0.6,
                with_payload: true,
            });
        }
    });

    it("restricts every search to the documents given, prefetches included", () => {
        const filter = { must: [{ key: "documentId", match: { any: ["a", "b"] } }] };
        const body = buildHybridQuery({ ...input(), documentIds: ["a", "b"] });
        const [dense, lexical] = prefetches(body);

        assert.deepEqual(body.filter, filter);
        assert.deepEqual(dense!.filter, filter);
        for (const language of lexical!.prefetch!) assert.deepEqual(language.filter, filter);

        assert.deepEqual(buildHybridQuery({ ...input({ enabled: false }), documentIds: ["a"] }).filter, {
            must: [{ key: "documentId", match: { any: ["a"] } }],
        });
    });

    it("searches all the documents without a list", () => {
        const body = buildHybridQuery(input());

        assert.equal(body.filter, undefined);
        assert.equal(prefetches(body)[0]!.filter, undefined);
    });
});
