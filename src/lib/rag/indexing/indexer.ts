import { getDocumentExtractor } from "./extractor-factory";
import { getDocumentChunker } from "./chunker-factory";
import { IndexingResult } from "./types"
import { replaceDocumentChunks } from "@/lib/mutations/chunk";
import { getDocumentWithSourceFolder } from "@/lib/queries/document";

export class DocumentIndexer {
  constructor(
    private readonly documentId: string
  ) {}

  async index(): Promise<IndexingResult> {
    const document = await getDocumentWithSourceFolder(this.documentId);

    if (!document) {
      throw new Error(
        `[DocumentIndexer] Document with id ${this.documentId} do not exists - Unable to index it`
      );
    }

    const extractor = getDocumentExtractor(document.mimeType);

    const extraction = await extractor.extract(document);

    const chunker = getDocumentChunker();

    const chunks = await chunker.chunk(extraction);

    await replaceDocumentChunks(document.id, chunks);

    return {
      fileName: document.fileName,
      extraction,
      chunks
    }
  }
}
