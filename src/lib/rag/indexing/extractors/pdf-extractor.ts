import { readFile } from "node:fs/promises";
import { extractTextItems } from "unpdf";
import type { StructuredTextItem } from "unpdf";

import type {
    DocumentExtractor,
    DocumentWithSourceFolder,
    ExtractedDocument,
} from "../types";
import { getDocumentPath } from "../indexing-utils";

export class PdfExtractor implements DocumentExtractor {
    async extract(
        document: DocumentWithSourceFolder,
    ): Promise<ExtractedDocument> { 
        const filePath = getDocumentPath(document);
        const buffer = await readFile(filePath);

        const { items } = await extractTextItems(
            new Uint8Array(buffer),
        );

        const blocks = items.flatMap(
            (pageItems, pageIndex) => {
                const text = pageItems
                    .map((item) => item.str)
                    .join(" ")
                    .trim();

                if (!text) {
                    return [];
                }

                return [{
                    text,
                    pageNumber: pageIndex + 1,
                    bounds: this.getBounds(pageItems),
                }];
            },
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