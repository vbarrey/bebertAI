import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GoogleDriveAuthError } from "@/lib/google-drive/auth";
import { GoogleDriveApiError } from "@/lib/google-drive/client";
import { chunkingSignature } from "@/lib/pipeline/parameters";

import { keepsChunksWithoutFile, reusesChunks } from "./reindex";

const pipeline = {
    extraction: { ocrEnabled: true, ocrMinCharsPerPage: 50, ocrLanguages: ["fra", "eng"] },
    chunking: { chunkSize: 2000, chunkOverlap: 200 },
};

describe("chunkingSignature", () => {
    it("is the same for parameters stored before the OCR fields existed, once their defaults are filled", () => {
        assert.equal(chunkingSignature({ ...pipeline, extraction: { ocrEnabled: true } as typeof pipeline.extraction }), chunkingSignature(pipeline));
    });

    it("changes with the extraction or the chunking", () => {
        assert.notEqual(chunkingSignature({ ...pipeline, chunking: { chunkSize: 1000, chunkOverlap: 200 } }), chunkingSignature(pipeline));
        assert.notEqual(chunkingSignature({ ...pipeline, extraction: { ...pipeline.extraction, ocrEnabled: false } }), chunkingSignature(pipeline));
    });
});

describe("reindex", () => {
    const signature = chunkingSignature(pipeline);

    it("only embeds again the chunks made with the pipeline's extraction and chunking", () => {
        assert.equal(reusesChunks({ chunkedWith: signature }, 12, signature), true);
        assert.equal(reusesChunks({ chunkedWith: chunkingSignature({ ...pipeline, chunking: { chunkSize: 1000, chunkOverlap: 0 } }) }, 12, signature), false);
        // Indexed before the signature existed, or never chunked.
        assert.equal(reusesChunks({ chunkedWith: null }, 12, signature), false);
        assert.equal(reusesChunks({ chunkedWith: signature }, 0, signature), false);
    });

    it("keeps the chunks when the Drive file is out of reach for good, never for a passing failure", () => {
        assert.equal(keepsChunksWithoutFile(12, new GoogleDriveAuthError()), true);
        assert.equal(keepsChunksWithoutFile(12, new GoogleDriveApiError(404, "File not found")), true);
        assert.equal(keepsChunksWithoutFile(12, new GoogleDriveApiError(503, "Backend Error")), false);
        assert.equal(keepsChunksWithoutFile(0, new GoogleDriveAuthError()), false);
        assert.equal(keepsChunksWithoutFile(12, new Error("OCR crashed")), false);
    });
});
