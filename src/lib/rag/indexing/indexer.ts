import { prisma } from "@/lib/prisma";
import { getDocumentExtractor } from "./extractor-factory";
import { getDocumentChunker } from "./chunker-factory";
import { IndexingResult } from "./types"

export class DocumentIndexer {
  constructor(
    private readonly documentId: string
  ) {}

  async index(): Promise<IndexingResult> {
    const document = await prisma.document.findUnique({
      where: { id: this.documentId },
      include: { sourceFolder: true }
    });

    if (!document) {
      throw new Error(
        `[DocumentIndexer] Document with id ${this.documentId} do not exists - Unable to index it`
      );
    }

    const extractor = getDocumentExtractor(document.mimeType);

    const extraction = await extractor.extract(document);

    console.log("Extractor => ", extraction);

    const chunker = getDocumentChunker();

    const chunks = await chunker.chunk(extraction);

    console.log("Chunks => ", chunks);

    return {
      fileName: document.fileName,
      extraction,
      chunks
    }
  }
}
