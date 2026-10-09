import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnrecoverableError } from "bullmq";

import { applyOcrToPages, countMeaningfulChars } from "./pdf-extractor";
import type { ExtractedBlock } from "../../types";
import type { ExtractionParameters } from "@/lib/pipeline/parameters";

const params: ExtractionParameters = {
    ocrEnabled: true,
    ocrMinCharsPerPage: 50,
    ocrLanguages: ["fra", "eng"],
};

const nativeText = "Cette page contient largement assez de texte natif pour être conservée telle quelle.";

const page = (pageNumber: number, text: string): ExtractedBlock => ({
    text,
    pageNumber,
    bounds: { x: 10, y: 20, width: 100, height: 50 },
});

function fakeOcr(results: Record<number, ExtractedBlock[]> = {}) {
    const calls: number[] = [];

    return {
        calls,
        ocrPage: async (pageNumber: number) => {
            calls.push(pageNumber);
            return results[pageNumber] ?? [{ text: `Texte OCR de la page ${pageNumber}, reconnu par Tesseract.` }];
        },
    };
}

describe("countMeaningfulChars", () => {
    it("ignores whitespace, punctuation and symbols", () => {
        assert.equal(countMeaningfulChars("  - 12 -  \n ... | é"), 3);
    });
});

describe("applyOcrToPages", () => {
    it("keeps a page with enough native text without OCR", async () => {
        const { calls, ocrPage } = fakeOcr();

        const blocks = await applyOcrToPages([page(1, nativeText)], params, ocrPage);

        assert.deepEqual(calls, []);
        assert.deepEqual(blocks, [page(1, nativeText)]);
    });

    it("OCRs a page without usable text (a lone page number is not enough)", async () => {
        const { calls, ocrPage } = fakeOcr({
            1: [{ text: "Texte reconnu sur la page scannée.", bounds: { x: 1, y: 2, width: 3, height: 4 } }],
        });

        const blocks = await applyOcrToPages([page(1, "- 3 -")], params, ocrPage);

        assert.deepEqual(calls, [1]);
        assert.deepEqual(blocks, [{
            text: "Texte reconnu sur la page scannée.",
            pageNumber: 1,
            bounds: { x: 1, y: 2, width: 3, height: 4 },
        }]);
    });

    it("OCRs only the pages that need it in a mixed PDF and keeps page order", async () => {
        const { calls, ocrPage } = fakeOcr();

        const blocks = await applyOcrToPages(
            [page(1, nativeText), page(2, ""), page(3, nativeText), page(4, "")],
            params,
            ocrPage,
        );

        assert.deepEqual(calls, [2, 4]);
        assert.deepEqual(blocks.map((block) => block.pageNumber), [1, 2, 3, 4]);
        assert.equal(blocks[0].text, nativeText);
        assert.match(blocks[1].text, /OCR de la page 2/);
    });

    it("uses native extraction only when OCR is disabled", async () => {
        const { calls, ocrPage } = fakeOcr();

        const blocks = await applyOcrToPages(
            [page(1, nativeText), page(2, "")],
            { ...params, ocrEnabled: false },
            ocrPage,
        );

        assert.deepEqual(calls, []);
        assert.deepEqual(blocks, [page(1, nativeText)]);
    });

    it("keeps the native text when OCR finds less of it", async () => {
        const { ocrPage } = fakeOcr({ 1: [] });

        const blocks = await applyOcrToPages([page(1, "Légende courte")], params, ocrPage);

        assert.deepEqual(blocks, [page(1, "Légende courte")]);
    });

    it("reports OCR progress without going backwards or beyond the total", async () => {
        const { ocrPage } = fakeOcr();
        const progress: [number, number][] = [];

        await applyOcrToPages(
            [page(1, ""), page(2, nativeText), page(3, "")],
            params,
            ocrPage,
            (current, total) => { progress.push([current, total]); },
        );

        assert.deepEqual(progress, [[1, 2], [2, 2]]);
    });

    it("fails with the page number on a render or OCR error", async () => {
        const ocrPage = async () => {
            throw new Error("pdftoppm a échoué : Syntax Error");
        };

        await assert.rejects(
            applyOcrToPages([page(1, nativeText), page(2, "")], params, ocrPage),
            (error: Error) =>
                !(error instanceof UnrecoverableError) &&
                error.message === "OCR de la page 2 : pdftoppm a échoué : Syntax Error",
        );
    });

    it("keeps missing Tesseract / language data unrecoverable", async () => {
        const ocrPage = async () => {
            throw new UnrecoverableError("Données linguistiques Tesseract manquantes (fra).");
        };

        await assert.rejects(
            applyOcrToPages([page(1, "")], params, ocrPage),
            (error: Error) =>
                error instanceof UnrecoverableError &&
                error.message.startsWith("OCR de la page 1 : Données linguistiques"),
        );
    });
});
