import { prisma } from "@/lib/prisma";
import { getDocumentExtractor } from "./extractor-factory";
import { getDocumentChunker } from "./chunker-factory";

export class DocumentIndexer {
  constructor(
    private readonly documentId: string
  ) {}

  async index(): Promise<void> {
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

    const extracted = await extractor.extract(document);

    const chunker = getDocumentChunker();

    const chunks = await chunker.chunk(extracted);
  }
}
