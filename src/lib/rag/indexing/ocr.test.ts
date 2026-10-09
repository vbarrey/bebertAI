import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import type { Document } from "@prisma/client";

import { listInstalledOcrLanguages, mergeIntoPageBlock, ocrImage, parseTesseractTsv } from "./ocr";
import { PdfExtractor } from "./extractors/pdf-extractor";
import { RecursiveCharacterChunker } from "./chunkers/RecursiveChunker";
import { defaultPipelineParameters } from "@/lib/pipeline/default";

const TSV_HEADER = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

describe("parseTesseractTsv", () => {
    it("groups words into paragraphs with bounds in a bottom-left origin", () => {
        const tsv = [
            TSV_HEADER,
            "1\t1\t0\t0\t0\t0\t0\t0\t1000\t2000\t-1\t",
            "2\t1\t1\t0\t0\t0\t100\t100\t300\t60\t-1\t",
            "5\t1\t1\t1\t1\t1\t100\t100\t120\t20\t96.5\tBonjour",
            "5\t1\t1\t1\t1\t2\t230\t100\t170\t20\t95.1\tle monde",
            "5\t1\t1\t1\t2\t1\t100\t140\t80\t20\t91.0\tSuite",
            "5\t1\t1\t1\t2\t2\t190\t140\t10\t20\t-1\t ",
            "5\t1\t2\t1\t1\t1\t100\t500\t200\t30\t90.0\tAutre",
            "",
        ].join("\n");

        assert.deepEqual(parseTesseractTsv(tsv, 0.5), [
            {
                text: "Bonjour le monde\nSuite",
                bounds: { x: 50, y: 920, width: 150, height: 30 },
            },
            {
                text: "Autre",
                bounds: { x: 50, y: 735, width: 100, height: 15 },
            },
        ]);
    });

    it("returns no block for an empty page", () => {
        assert.deepEqual(parseTesseractTsv(`${TSV_HEADER}\n1\t1\t0\t0\t0\t0\t0\t0\t10\t10\t-1\t\n`), []);
    });
});

describe("mergeIntoPageBlock", () => {
    it("joins paragraphs with blank lines and unions their bounds", () => {
        assert.deepEqual(
            mergeIntoPageBlock([
                { text: "Titre", bounds: { x: 50, y: 700, width: 100, height: 20 } },
                { text: "FA", bounds: { x: 300, y: 650, width: 10, height: 10 } },
                { text: "Corps du texte", bounds: { x: 40, y: 100, width: 200, height: 400 } },
            ]),
            [{
                text: "Titre\n\nFA\n\nCorps du texte",
                bounds: { x: 40, y: 100, width: 270, height: 620 },
            }],
        );
    });

    it("returns no block for an empty page", () => {
        assert.deepEqual(mergeIntoPageBlock([]), []);
    });
});

/*
 * Real engine: runs only where Tesseract and Poppler are installed (Docker image).
 */
const hasOcrTools = (() => {
    try {
        execFileSync("tesseract", ["--version"], { stdio: "ignore" });
        execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
})();

const STORAGE = process.env.DOCUMENTS_STORAGE_PATH ?? "./data/documents";

// getDocumentPath() resolves storagePath against the storage folder.
function fixtureDocument(name: string): Document {
    return {
        id: name,
        storagePath: path.relative(STORAGE, path.resolve("src/lib/rag/indexing/__fixtures__", name)),
        language: null,
    } as Document;
}

const ocrParameters = { ...defaultPipelineParameters.extraction, ocrEnabled: true };

describe("OCR with real Tesseract", { skip: !hasOcrTools && "tesseract / pdftoppm not installed" }, () => {
    it("lists installed recognition languages without osd", async () => {
        const languages = await listInstalledOcrLanguages();

        assert.ok(languages.includes("fra") && languages.includes("eng"));
        assert.ok(!languages.includes("osd"));
    });

    it("keeps the native page and OCRs only the scanned page of a mixed PDF", async () => {
        const progress: [number, number][] = [];

        const { blocks } = await new PdfExtractor(ocrParameters).extract(
            fixtureDocument("mixed.pdf"),
            (current, total) => { progress.push([current, total]); },
        );

        const page1 = blocks.filter((block) => block.pageNumber === 1);
        const page2 = blocks.filter((block) => block.pageNumber === 2);

        // Native extraction: one block per page, exact text.
        assert.equal(page1.length, 1);
        assert.match(page1[0].text, /Cette page contient une couche texte exploitable\./);

        // One block per page, paragraphs separated by blank lines.
        assert.equal(page2.length, 1);
        assert.match(page2[0].text, /Facture scann[ée]e/);
        assert.match(page2[0].text, /canap[ée]/);
        assert.match(page2[0].text, /\n\nSecond paragraphe/);

        // Bounds are PDF points inside the A4-width page.
        for (const { bounds } of page2) {
            assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 595 && bounds.y >= 0);
        }

        assert.deepEqual(progress, [[1, 1]]);

        // Downstream steps do not care where the text came from.
        const chunks = await new RecursiveCharacterChunker({ chunkSize: 300, chunkOverlap: 50 })
            .chunk({ blocks });

        assert.deepEqual(
            [...new Set(chunks.map((chunk) => chunk.pageNumber))],
            [1, 2],
        );
        assert.ok(chunks.every((chunk) => chunk.bounds));
    });

    it("does not run OCR when it is disabled", async () => {
        const { blocks } = await new PdfExtractor({ ...ocrParameters, ocrEnabled: false })
            .extract(fixtureDocument("mixed.pdf"));

        assert.deepEqual(blocks.map((block) => block.pageNumber), [1]);
    });

    it("OCRs a PNG image", async () => {
        const blocks = await ocrImage(path.resolve("src/lib/rag/indexing/__fixtures__/scan.png"), "fra+eng");

        assert.match(blocks.map((block) => block.text).join("\n"), /Second paragraphe du document/);
    });
});
