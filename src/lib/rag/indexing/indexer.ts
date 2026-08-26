import { getDocumentExtractor } from "./extractor-factory";
import { getDocumentChunker } from "./chunker-factory";
import { replaceDocumentChunks } from "@/lib/mutations/chunk";
import { getDocumentWithSourceFolder } from "@/lib/queries/document";
import { IndexingProgressCallback } from "./types";

export class DocumentIndexer {
  constructor(
    private readonly documentId: string,
    private readonly onProgress?: IndexingProgressCallback
  ) {}

  async index(): Promise<void> {
    const document = await getDocumentWithSourceFolder(this.documentId);

    if (!document) {
      throw new Error(
        `[DocumentIndexer] Document with id ${this.documentId} do not exists - Unable to index it`
      );
    }

    const extractor = getDocumentExtractor(document.mimeType);

    await this.onProgress?.({
      stage: "EXTRACTING",
    });

    const extraction = await extractor.extract(document);

    const chunker = getDocumentChunker();

    await this.onProgress?.({
      stage: "CHUNKING",
    });

    const chunks = await chunker.chunk(extraction);

    await this.onProgress?.({
      stage: "PERSISTING",
    }); 

    await replaceDocumentChunks(document.id, chunks);
  }
}
