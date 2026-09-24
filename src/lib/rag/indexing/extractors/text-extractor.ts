import {
  DocumentExtractor,
  ExtractedDocument,
  DocumentWithSourceFolder,
  ExtractedBlock,
} from "../../types";

import { readFile } from "node:fs/promises";
import { getDocumentPath, splitTextIntoBlocks } from "../indexing-utils";

export class TextExtractor implements DocumentExtractor {
  async extract(
    document: DocumentWithSourceFolder
  ): Promise<ExtractedDocument> {
    const filePath = getDocumentPath(document);
    const text = await readFile(filePath, "utf8");

    return {
      blocks: splitTextIntoBlocks(text),
      language: document.language ?? undefined,
    };
  }
}
