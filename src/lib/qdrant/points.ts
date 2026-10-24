import type { Chunk } from "@prisma/client";
import { ChunkEmbedding } from "../ai/types";
import type { Bm25Language, PipelineParameters } from "@/lib/pipeline/parameters";
import { qdrant } from "./client";
import { chunksCollection } from "./collections";
import { getQdrantPointId } from "./ids";
import { bm25Document, sparseVectorName } from "./bm25";

/** Upserts each chunk with its dense embedding and the BM25 sparse vector of its language. */
export async function upsertChunkEmbeddings(
  // The owner of the documents: their collection.
  userId: string,
  chunks: Chunk[],
  embeddings: ChunkEmbedding[],
  sparse: PipelineParameters["embedding"]["sparse"],
  chunkSize: number,
): Promise<void> {
  const embeddingByChunkId = new Map(embeddings.map(({ chunkId, embedding }) => [chunkId, embedding]));

  await qdrant.upsert(chunksCollection(userId), {
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
  userId: string,
  documentId: string,
): Promise<void> {
  const collection = chunksCollection(userId);
  const { exists } = await qdrant.collectionExists(collection);

  if (!exists) {
    return;
  }

  await qdrant.delete(collection, {
    wait: true,
    filter: {
      must: [{ key: "documentId", match: { value: documentId } }],
    },
  });
}