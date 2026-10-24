import { prisma } from "@/lib/prisma";

import { qdrant } from "./client";
import { SPARSE_VECTOR_NAMES } from "./bm25";

// The single collection of before the users, kept as the first admin's (adoptLegacyChunksCollection).
const LEGACY_COLLECTION = "document_chunks";

/** Each user's chunks in a collection of their own: their embedding model sets its vector dimension. */
export function chunksCollection(userId: string): string {
  return `chunks_${userId}`;
}

/**
 * Deletes the user's collection. The first admin's may be an alias of the legacy collection: deleting by the alias
 * name does nothing, its collection is deleted (and the alias with it).
 */
export async function deleteChunksCollection(userId: string): Promise<void> {
  const name = chunksCollection(userId);
  const { aliases } = await qdrant.getAliases();
  const collection = aliases.find((alias) => alias.alias_name === name)?.collection_name ?? name;

  if ((await qdrant.collectionExists(collection)).exists) {
    await qdrant.deleteCollection(collection);
  }
}

/** True for a collection created before the BM25 vectors existed: its points cannot answer lexical queries. */
export async function chunksCollectionLacksSparseVectors(userId: string): Promise<boolean> {
  const name = chunksCollection(userId);

  if (!(await qdrant.collectionExists(name)).exists) {
    return false;
  }

  const { config } = await qdrant.getCollection(name);
  const sparseVectors = config.params.sparse_vectors ?? {};

  return SPARSE_VECTOR_NAMES.some((vectorName) => !(vectorName in sparseVectors));
}

export async function ensureChunksCollection(
  userId: string,
  vectorSize: number,
): Promise<void> {
  const name = chunksCollection(userId);

  // collectionExists, not the collection list: it resolves aliases.
  if ((await qdrant.collectionExists(name)).exists) {
    const { config } = await qdrant.getCollection(name);
    const { vectors } = config.params;
    const collectionSize = vectors && "size" in vectors ? vectors.size : undefined;

    if (collectionSize !== undefined && collectionSize !== vectorSize) {
      throw new Error(
        `Le modèle d'embedding produit des vecteurs de dimension ${vectorSize} mais la collection "${name}" attend ${collectionSize}. ` +
        `Supprimez la collection et réindexez tous les documents après un changement de modèle.`,
      );
    }

    return;
  }

  await qdrant.createCollection(name, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
    // Qdrant computes the BM25 weights from the texts; the idf modifier adds the inverse document frequency.
    sparse_vectors: Object.fromEntries(
      SPARSE_VECTOR_NAMES.map((vectorName) => [vectorName, { modifier: "idf" as const }]),
    ),
  });
}

/**
 * The chunks indexed before the users belong to the first admin: their collection becomes an alias of the legacy
 * one, with no reindexing. Runs at start-up, does nothing once done or without legacy collection.
 */
export async function adoptLegacyChunksCollection(): Promise<void> {
  if (!(await qdrant.collectionExists(LEGACY_COLLECTION)).exists) return;

  const admin = await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) return;

  const name = chunksCollection(admin.id);
  if ((await qdrant.collectionExists(name)).exists) return;

  await qdrant.updateCollectionAliases({
    actions: [{ create_alias: { collection_name: LEGACY_COLLECTION, alias_name: name } }],
  });
  console.log(`Collection "${LEGACY_COLLECTION}" reprise comme "${name}".`);
}
