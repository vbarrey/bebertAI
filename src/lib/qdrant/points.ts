import { ChunkEmbedding } from "../ai/types";
import { qdrant } from "./client";
import { CHUNKS_COLLECTION } from "./collections";
import { getQdrantPointId } from "./ids";

type ChunkPoint = {
  chunkId: string;
  documentId: string;
  vector: number[];
};

export async function upsertChunkEmbeddings(
  chunks: ChunkEmbedding[],
): Promise<void> {
  await qdrant.upsert(CHUNKS_COLLECTION, {
    wait: true,
    points: chunks.map(({ chunkId, documentId, embedding }) => ({
      id: getQdrantPointId(chunkId),
      vector: embedding,
      payload: {
        chunkId,
        documentId,
      },
    })),
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

export async function searchSimilarChunks(
  vector: number[],
  limit = 5,
) {
  return qdrant.query(CHUNKS_COLLECTION, {
    query: vector,
    limit,
    with_payload: true,
  });
}