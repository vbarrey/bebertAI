import { Document } from "@prisma/client";

import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../../types";
import { getDocumentPath } from "../indexing-utils";
import { getOcrLanguages, ocrImage } from "../ocr";
import type { ExtractionParameters } from "@/lib/pipeline/parameters";

// PNG / JPEG: OCR is the only way to get text out of them.
export class ImageExtractor implements DocumentExtractor {
  constructor(
    private readonly parameters: ExtractionParameters,
  ) {}

  async extract(
    document: Document,
  ): Promise<ExtractedDocument> {
    // Without OCR there is no text: the worker reports the empty extraction.
    const blocks = this.parameters.ocrEnabled
      ? await ocrImage(
        getDocumentPath(document),
        await getOcrLanguages(this.parameters.ocrLanguages),
      )
      : [];

    return {
      blocks,
      language: document.language ?? undefined,
    };
  }
}
