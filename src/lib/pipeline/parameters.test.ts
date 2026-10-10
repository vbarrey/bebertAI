import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPipelineParameters } from "./default";
import { PipelineParametersSchema, requiresReindex } from "./parameters";

describe("PipelineParametersSchema extraction", () => {
    it("accepts the defaults", () => {
        assert.deepEqual(
            PipelineParametersSchema.parse(defaultPipelineParameters),
            defaultPipelineParameters,
        );
    });

    it("fills the OCR fields of parameters stored before they existed", () => {
        const stored = JSON.parse(JSON.stringify(defaultPipelineParameters));
        stored.extraction = { ocrEnabled: true };

        assert.deepEqual(PipelineParametersSchema.parse(stored).extraction, {
            ocrEnabled: true,
            ocrMinCharsPerPage: 50,
            ocrLanguages: ["fra", "eng"],
        });
    });

    it("disables thinking for generation parameters stored before the option existed", () => {
        const stored = JSON.parse(JSON.stringify(defaultPipelineParameters));
        delete stored.generation.think;

        assert.equal(PipelineParametersSchema.parse(stored).generation.think, false);
    });

    it("accepts any well-formed Tesseract language code", () => {
        const extraction = { ocrEnabled: true, ocrMinCharsPerPage: 50, ocrLanguages: ["deu", "rus", "deu_latf"] };

        assert.deepEqual(
            PipelineParametersSchema.parse({ ...defaultPipelineParameters, extraction }).extraction,
            extraction,
        );
    });

    it("rejects malformed languages, an empty language list and a negative threshold", () => {
        for (const extraction of [
            { ocrEnabled: true, ocrLanguages: ["fra; rm -rf /"] },
            { ocrEnabled: true, ocrLanguages: ["fra+eng"] },
            { ocrEnabled: true, ocrLanguages: ["../fra"] },
            { ocrEnabled: true, ocrLanguages: ["-l"] },
            { ocrEnabled: true, ocrLanguages: [] },
            { ocrEnabled: true, ocrMinCharsPerPage: -1 },
        ]) {
            assert.throws(() =>
                PipelineParametersSchema.parse({ ...defaultPipelineParameters, extraction }),
            );
        }
    });
});

describe("PipelineParametersSchema hybrid search", () => {
    it("fills the BM25 and hybrid fields of parameters stored before they existed", () => {
        const stored = JSON.parse(JSON.stringify(defaultPipelineParameters));
        delete stored.embedding.sparse;
        delete stored.retrieval.hybrid;

        assert.deepEqual(PipelineParametersSchema.parse(stored), defaultPipelineParameters);
    });

    it("fills a partially stored hybrid configuration", () => {
        const stored = JSON.parse(JSON.stringify(defaultPipelineParameters));
        stored.retrieval.hybrid = { enabled: false };

        assert.deepEqual(PipelineParametersSchema.parse(stored).retrieval.hybrid, {
            ...defaultPipelineParameters.retrieval.hybrid,
            enabled: false,
        });
    });

    it("keeps the BM25 defaults for embedding parameters stored as { document, request }", () => {
        const stored = JSON.parse(JSON.stringify(defaultPipelineParameters));
        stored.embedding = {
            document: { providerId: "ollama", modelName: "bge-m3" },
            request: { providerId: "ollama", modelName: "other" },
        };

        assert.deepEqual(PipelineParametersSchema.parse(stored).embedding, {
            providerId: "ollama",
            modelName: "bge-m3",
            sparse: defaultPipelineParameters.embedding.sparse,
        });
    });

    it("rejects out of range BM25 or RRF values", () => {
        const defaults = defaultPipelineParameters;

        for (const parameters of [
            { ...defaults, embedding: { ...defaults.embedding, sparse: { ...defaults.embedding.sparse, b: 1.5 } } },
            { ...defaults, embedding: { ...defaults.embedding, sparse: { ...defaults.embedding.sparse, k: 0 } } },
            { ...defaults, retrieval: { ...defaults.retrieval, hybrid: { ...defaults.retrieval.hybrid, rrfK: 0 } } },
            { ...defaults, retrieval: { ...defaults.retrieval, hybrid: { ...defaults.retrieval.hybrid, sparseWeight: -1 } } },
        ]) {
            assert.throws(() => PipelineParametersSchema.parse(parameters));
        }
    });
});

describe("requiresReindex", () => {
    const copy = () => JSON.parse(JSON.stringify(defaultPipelineParameters));

    it("is false for unchanged parameters and query-time steps", () => {
        const next = copy();
        next.import.storagePath = "./elsewhere";
        next.retrieval.topK = 12;
        next.retrieval.hybrid.sparseWeight = 2;
        next.generation.temperature = 0.1;

        assert.equal(requiresReindex(defaultPipelineParameters, next), false);
    });

    it("is true when extraction, chunking or embedding changes", () => {
        for (const change of [
            (p: typeof defaultPipelineParameters) => { p.extraction.ocrEnabled = true; },
            (p: typeof defaultPipelineParameters) => { p.extraction.ocrMinCharsPerPage = 10; },
            (p: typeof defaultPipelineParameters) => { p.chunking.chunkSize = 500; },
            (p: typeof defaultPipelineParameters) => { p.embedding.modelName = "bge-m3"; },
            (p: typeof defaultPipelineParameters) => { p.embedding.sparse.asciiFolding = false; },
        ]) {
            const next = copy();
            change(next);
            assert.equal(requiresReindex(defaultPipelineParameters, next), true);
        }
    });
});
