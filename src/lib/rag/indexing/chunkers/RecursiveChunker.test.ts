import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeShortChunks } from "./RecursiveChunker";

const LONG = "Le carburateur se règle avec la vis de richesse.";

const chunk = (text: string, pageNumber: number) => ({ position: pageNumber - 1, text, pageNumber });

describe("mergeShortChunks", () => {
    it("keeps chunks long enough as they are", () => {
        const chunks = [chunk(LONG, 1), chunk(LONG, 2)];

        assert.deepEqual(mergeShortChunks(chunks), chunks);
    });

    it("merges a short chunk into the next one, which keeps its page, and renumbers", () => {
        assert.deepEqual(mergeShortChunks([chunk("RENAULI", 1), chunk(LONG, 2), chunk(LONG, 3)]), [
            { position: 0, text: `RENAULI\n\n${LONG}`, pageNumber: 2 },
            { position: 1, text: LONG, pageNumber: 3 },
        ]);
    });

    it("merges consecutive short chunks together into the next one", () => {
        assert.deepEqual(mergeShortChunks([chunk("v", 1), chunk("- 3 -", 2), chunk(LONG, 3)]), [
            { position: 0, text: `v\n\n- 3 -\n\n${LONG}`, pageNumber: 3 },
        ]);
    });

    it("merges a short last chunk into the previous one", () => {
        assert.deepEqual(mergeShortChunks([chunk(LONG, 1), chunk("v", 2)]), [
            { position: 0, text: `${LONG}\n\nv`, pageNumber: 1 },
        ]);
    });

    it("keeps a document short as a whole as one chunk", () => {
        assert.deepEqual(mergeShortChunks([chunk("IMG 2041", 1), chunk("v", 2)]), [
            { position: 0, text: "IMG 2041\n\nv", pageNumber: 1 },
        ]);
        assert.deepEqual(mergeShortChunks([]), []);
    });
});
