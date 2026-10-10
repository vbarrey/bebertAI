import type { Chunk } from "@prisma/client";
import { ChunkEmbedding } from "../ai/types";
import type { Bm25Language, PipelineParameters } from "@/lib/pipeline/parameters";
import { qdrant } from "./client";
import { CHUNKS_COLLECTION } from "./collections";
import { getQdrantPointId } from "./ids";
import { bm25Document, sparseVectorName } from "./bm25";

/** Upserts each chunk with its dense embedding and the BM25 sparse vector of its language. */
export async function upsertChunkEmbeddings(
  chunks: Chunk[],
  embeddings: ChunkEmbedding[],
  sparse: PipelineParameters["embedding"]["sparse"],
  chunkSize: number,
): Promise<void> {
  const embeddingByChunkId = new Map(embeddings.map(({ chunkId, embedding }) => [chunkId, embedding]));

  await qdrant.upsert(CHUNKS_COLLECTION, {
    wait: true,
    points: chunks.map((chunk) => {
      const embedding = embeddingByChunkId.get(chunk.id);

      if (!embedding) {
        throw new Error(`No embedding was generated for chunk ${chunk.id}`);
      }

      // Written by the indexing worker from detectLanguage.
      const language = chunk.language as Bm25Language | null;

      return {
        id: getQdrantPointId(chunk.id),
        vector: {
          "": embedding,
          [sparseVectorName(language)]: bm25Document(chunk.text, language, sparse, chunkSize),
        },
        payload: {
          chunkId: chunk.id,
          documentId: chunk.documentId,
        },
      };
    }),
  });
}

export async function deleteDocumentEmbeddings(
  documentId: string,
): Promise<void> {
  const { exists } = await qdrant.collectionExists(CHUNKS_COLLECTION);

  if (!exists) {
    return;
  }

  await qdrant.delete(CHUNKS_COLLECTION, {
    wait: true,
    filter: {
      must: [{ key: "documentId", match: { value: documentId } }],
    },
  });
}