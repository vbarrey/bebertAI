import { readFile } from "node:fs/promises";
import { UnrecoverableError } from "bullmq";
import { extractTextItems } from "unpdf";
import type { StructuredTextItem } from "unpdf";

import type {
    DocumentExtractor,
    ExtractedBlock,
    ExtractedDocument,
    ExtractionProgress,
} from "../../types";

import { Document } from "@prisma/client";

import { getDocumentPath } from "../indexing-utils";
import { getOcrLanguages, ocrPdfPage } from "../ocr";
import type { ExtractionParameters } from "@/lib/pipeline/parameters";

/**
 * Letters and digits only: whitespace, punctuation and stray glyphs do not make a page usable.
 */
export function countMeaningfulChars(text: string): number {
    return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

/**
 * Keeps the native text of each page and OCRs only the pages below the threshold.
 * `nativePages[i]` is the native block of page i + 1 (empty text when none).
 */
export async function applyOcrToPages(
    nativePages: ExtractedBlock[],
    { ocrEnabled, ocrMinCharsPerPage }: ExtractionParameters,
    ocrPage: (pageNumber: number) => Promise<ExtractedBlock[]>,
    onProgress?: ExtractionProgress,
): Promise<ExtractedBlock[]> {
    const pagesToOcr = ocrEnabled
        ? nativePages.filter(
            (page) => countMeaningfulChars(page.text) < ocrMinCharsPerPage,
        )
        : [];

    const ocrResults = new Map<number, ExtractedBlock[]>();

    for (const [index, page] of pagesToOcr.entries()) {
        const pageNumber = page.pageNumber!;

        try {
            ocrResults.set(pageNumber, await ocrPage(pageNumber));
        } catch (error) {
            const message = `OCR de la page ${pageNumber} : ${error instanceof Error ? error.message : String(error)}`;

            throw error instanceof UnrecoverableError
                ? new UnrecoverableError(message)
                : new Error(message, { cause: error });
        }

        await onProgress?.(index + 1, pagesToOcr.length);
    }

    return nativePages.flatMap((page) => {
        const ocrBlocks = ocrResults.get(page.pageNumber!);

        // OCR only replaces the native text when it found more of it (a blank scan keeps its few native chars).
        if (
            ocrBlocks &&
            countMeaningfulChars(ocrBlocks.map((block) => block.text).join(" ")) >
                countMeaningfulChars(page.text)
        ) {
            return ocrBlocks.map((block) => ({ ...block, pageNumber: page.pageNumber }));
        }

        return page.text ? [page] : [];
    });
}

export class PdfExtractor implements DocumentExtractor {
    constructor(
        private readonly parameters: ExtractionParameters,
    ) {}

    async extract(
        document: Document,
        onProgress?: ExtractionProgress,
    ): Promise<ExtractedDocument> {
        const filePath = getDocumentPath(document);
        const buffer = await readFile(filePath);

        const { items } = await extractTextItems(
            new Uint8Array(buffer),
        );

        const nativePages = items.map((pageItems, pageIndex) => ({
            text: pageItems
                .map((item) => item.str)
                .join(" ")
                .trim(),
            pageNumber: pageIndex + 1,
            bounds: this.getBounds(pageItems),
        }));

        // Resolved once per document, and only if a page actually needs OCR.
        let languages: Promise<string> | undefined;

        const blocks = await applyOcrToPages(
            nativePages,
            this.parameters,
            async (pageNumber) => {
                languages ??= getOcrLanguages(this.parameters.ocrLanguages);

                return ocrPdfPage(filePath, pageNumber, await languages);
            },
            onProgress,
        );

        return {
            blocks,
            language: document.language ?? undefined,
        };
    }

    private getBounds(
        items: StructuredTextItem[],
    ) {
        if (items.length === 0) {
            return undefined;
        }

        const x = Math.min(
            ...items.map((item) => item.x),
        );

        const y = Math.min(
            ...items.map((item) => item.y),
        );

        const right = Math.max(
            ...items.map(
                (item) => item.x + item.width,
            ),
        );

        const top = Math.max(
            ...items.map(
                (item) => item.y + item.height,
            ),
        );

        return {
            x,
            y,
            width: right - x,
            height: top - y,
        };
    }
}
