import { qdrant } from "./client";
import { SPARSE_VECTOR_NAMES } from "./bm25";

export const CHUNKS_COLLECTION = "document_chunks";

export async function deleteChunksCollection(): Promise<void> {
  if ((await qdrant.collectionExists(CHUNKS_COLLECTION)).exists) {
    await qdrant.deleteCollection(CHUNKS_COLLECTION);
  }
}

/** True for a collection created before the BM25 vectors existed: its points cannot answer lexical queries. */
export async function chunksCollectionLacksSparseVectors(): Promise<boolean> {
  if (!(await qdrant.collectionExists(CHUNKS_COLLECTION)).exists) {
    return false;
  }

  const { config } = await qdrant.getCollection(CHUNKS_COLLECTION);
  const sparseVectors = config.params.sparse_vectors ?? {};

  return SPARSE_VECTOR_NAMES.some((name) => !(name in sparseVectors));
}

export async function ensureChunksCollection(
  vectorSize: number,
): Promise<void> {
  const { collections } = await qdrant.getCollections();

  const exists = collections.some(
    (collection) => collection.name === CHUNKS_COLLECTION,
  );

  if (exists) {
    const { config } = await qdrant.getCollection(CHUNKS_COLLECTION);
    const { vectors } = config.params;
    const collectionSize = vectors && "size" in vectors ? vectors.size : undefined;

    if (collectionSize !== undefined && collectionSize !== vectorSize) {
      throw new Error(
        `Le modèle d'embedding produit des vecteurs de dimension ${vectorSize} mais la collection "${CHUNKS_COLLECTION}" attend ${collectionSize}. ` +
        `Supprimez la collection et réindexez tous les documents après un changement de modèle.`,
      );
    }

    return;
  }

  await qdrant.createCollection(CHUNKS_COLLECTION, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
    // Qdrant computes the BM25 weights from the texts; the idf modifier adds the inverse document frequency.
    sparse_vectors: Object.fromEntries(
      SPARSE_VECTOR_NAMES.map((name) => [name, { modifier: "idf" as const }]),
    ),
  });
}