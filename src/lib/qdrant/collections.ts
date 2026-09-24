import { qdrant } from "./client";

export const CHUNKS_COLLECTION = "document_chunks";

export async function ensureChunksCollection(
  vectorSize: number,
): Promise<void> {
  const { collections } = await qdrant.getCollections();

  const exists = collections.some(
    (collection) => collection.name === CHUNKS_COLLECTION,
  );

  if (exists) {
    return;
  }

  await qdrant.createCollection(CHUNKS_COLLECTION, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });
}