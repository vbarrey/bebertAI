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
  });
}