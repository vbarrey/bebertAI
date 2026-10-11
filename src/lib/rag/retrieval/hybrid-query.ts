import type { Schemas } from "@qdrant/js-client-rest";

import { BM25_LANGUAGES, type PipelineParameters } from "@/lib/pipeline/parameters";
import { bm25Document, sparseVectorName } from "@/lib/qdrant/bm25";
import type { QueryTranslations } from "./query-translator";

type HybridQueryInput = {
    // Embedding of the query as typed.
    vector: number[];
    // The query as typed, searched in the chunks of unknown language (BM25 without stemmer).
    query: string;
    translations: QueryTranslations;
    retrieval: PipelineParameters["retrieval"];
    sparse: PipelineParameters["embedding"]["sparse"];
    // Same as at indexing: the BM25 options of the query and of the chunks must match.
    chunkSize: number;
};

/**
 * Body of the Qdrant query: the semantic results and the BM25 results of all the languages, fused by RRF.
 * The semantic threshold filters the dense prefetch only: fused RRF scores are ranks, not similarities.
 * Without hybrid search (disabled, or a lexical weight of 0), the semantic search alone as before.
 */
export function buildHybridQuery({
    vector,
    query,
    translations,
    retrieval,
    sparse,
    chunkSize,
}: HybridQueryInput): Schemas["QueryRequest"] {
    const { topK, scoreThreshold, hybrid } = retrieval;

    if (!hybrid.enabled || hybrid.sparseWeight === 0) {
        return { query: vector, limit: topK, score_threshold: scoreThreshold, with_payload: true };
    }

    const lexical = [
        ...BM25_LANGUAGES.map((language) => ({ language, text: translations[language] })),
        { language: null, text: query },
    ].map(({ language, text }) => ({
        query: bm25Document(text, language, sparse, chunkSize),
        using: sparseVectorName(language),
        limit: hybrid.sparseLimit,
    }));

    const scores = lexical.map((_, index) => `$score[${index}]`);

    return {
        prefetch: [
            { query: vector, limit: hybrid.denseLimit, score_threshold: scoreThreshold },
            {
                // One lexical list ranked by BM25 score. Fusing the language lists by RRF would rank the best match
                // of every language first, a weak Russian match level with a strong French one. A chunk is in the
                // list of its language only, so the sum is its BM25 score.
                prefetch: lexical,
                query: {
                    formula: { sum: scores },
                    defaults: Object.fromEntries(scores.map((score) => [score, 0])),
                },
                limit: hybrid.sparseLimit,
            },
        ],
        query: { rrf: { k: hybrid.rrfK, weights: [1, hybrid.sparseWeight] } },
        limit: topK,
        with_payload: true,
    };
}
