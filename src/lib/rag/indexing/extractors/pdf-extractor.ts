import { readFile } from "node:fs/promises";
import { extractTextItems, StructuredTextItem } from "unpdf";

import type {
  DocumentExtractor,
  DocumentWithSourceFolder,
  ExtractedDocument,
  ExtractedBlock,
} from "../types";

import { getDocumentPath } from "../indexing-utils";

export class PdfExtractor implements DocumentExtractor {
  async extract(
    document: DocumentWithSourceFolder
  ): Promise<ExtractedDocument> {
    const filePath = getDocumentPath(document);
    const buffer = await readFile(filePath);

    const { items } = await extractTextItems(new Uint8Array(buffer));

    const blocks: ExtractedBlock[] = [];

    for (const [pageIndex, pageItems] of items.entries()) {
      const pageNumber = pageIndex + 1;

      let currentItems = [];

      for (const item of pageItems) {
        if (!item.str.trim()) {
          continue;
        }

        currentItems.push(item);

        if (item.hasEOL) {
          blocks.push(this.createBlock(currentItems, pageNumber));

          currentItems = [];
        }
      }

      if (currentItems.length > 0) {
        blocks.push(this.createBlock(currentItems, pageNumber));
      }
    }

    return {
      blocks,
      language: document.language ?? undefined,
    };
  }

  private createBlock(
    items: StructuredTextItem[],
    pageNumber: number
  ): ExtractedBlock {
    const text = items
      .map((item) => item.str)
      .join(" ")
      .trim();

    const bounds = this.getBounds(items);

    return {
      text,
      pageNumber,
      bounds,
    };
  }

  private getBounds(
    items: StructuredTextItem[]
  ): NonNullable<ExtractedBlock["bounds"]> {
    const x = Math.min(...items.map((item) => item.x));
    const y = Math.min(...items.map((item) => item.y));

    const right = Math.max(...items.map((item) => item.x + item.width));

    const top = Math.max(...items.map((item) => item.y + item.height));

    return {
      x,
      y,
      width: right - x,
      height: top - y,
    };
  }
}