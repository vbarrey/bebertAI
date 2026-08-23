import { getDocumentPath, splitTextIntoBlocks } from "../indexing-utils";
import {
  DocumentExtractor,
  ExtractedDocument,
  DocumentWithSourceFolder,
} from "../types";
import mammoth from "mammoth";

export class DocxExtractor implements DocumentExtractor {
  async extract(
    document: DocumentWithSourceFolder
  ): Promise<ExtractedDocument> {
    const filePath = getDocumentPath(document);

    const result = await mammoth.extractRawText({
      path: filePath,
    });

    return {
      blocks: splitTextIntoBlocks(result.value),
      language: document.language ?? undefined,
    };
  }
}
