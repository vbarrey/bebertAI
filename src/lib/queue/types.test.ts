import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IndexingStage, indexingProgressPercent } from "./types";

describe("indexingProgressPercent", () => {
    it("gives each stage an equal share and fills the extraction with the OCR pages", () => {
        assert.equal(indexingProgressPercent({ stage: IndexingStage.CREATING }), 0);
        assert.equal(indexingProgressPercent({ stage: IndexingStage.EXTRACTING }), 17);
        assert.equal(indexingProgressPercent({ stage: IndexingStage.EXTRACTING, current: 5, total: 10 }), 25);
        assert.equal(indexingProgressPercent({ stage: IndexingStage.CHUNKING }), 33);
        assert.equal(indexingProgressPercent({ stage: IndexingStage.PERSISTING_EMBEDDINGS }), 83);
        assert.equal(indexingProgressPercent({ stage: IndexingStage.COMPLETED }), 100);
    });

    it("never goes past the stage when current exceeds total, nor below 0 for a failure", () => {
        assert.equal(indexingProgressPercent({ stage: IndexingStage.EXTRACTING, current: 12, total: 10 }), 33);
        assert.equal(indexingProgressPercent({ stage: IndexingStage.FAILED }), 0);
    });
});
