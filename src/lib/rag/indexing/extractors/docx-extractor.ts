import { splitTextIntoBlocks } from "../indexing-utils";
import {
  DocumentExtractor,
  ExtractedDocument,
} from "../../types";
import mammoth from "mammoth";
import { Document } from "@prisma/client";

export class DocxExtractor implements DocumentExtractor {
  async extract(
    filePath: string,
    document: Document
  ): Promise<ExtractedDocument> {
    const result = await mammoth.extractRawText({
      path: filePath,
    });

    return {
      blocks: splitTextIntoBlocks(result.value),
      language: document.language ?? undefined,
    };
  }
}
