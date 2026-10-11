import {
  DocumentExtractor,
  ExtractedDocument
} from "../../types";
import { Document } from "@prisma/client";

import { readFile } from "node:fs/promises";
import { splitTextIntoBlocks } from "../indexing-utils";

export class TextExtractor implements DocumentExtractor {
  async extract(
    filePath: string,
    document: Document
  ): Promise<ExtractedDocument> {
    const text = await readFile(filePath, "utf8");

    return {
      blocks: splitTextIntoBlocks(text),
      language: document.language ?? undefined,
    };
  }
}
