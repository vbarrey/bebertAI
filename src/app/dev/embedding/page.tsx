import { aiProviderRegistry } from "@/lib/ai/registry";
import { ensureChunksCollection } from "@/lib/qdrant/collections";

export default async function EmbeddingPlayground() {
  const providerId = "cmtlhix040000qccs8q1t11li";

  const provider = aiProviderRegistry.get(providerId);

  if (!provider || !provider.embed) throw new Error("Pas de provider où pas d'implémentation");

  const chunks = [
    "Les encres utilisées en imprimerie.",
    "Les différents types de papier.",
    "La mécanique d'une presse offset.",
  ];

  const embeddings = await provider.embed({ model: "qwen3-embedding:4b", chunks });

  if (embeddings.length === 0) {
    throw new Error("Aucun embedding généré");
  }

  const vectorSize = embeddings[0].length;

  await ensureChunksCollection(vectorSize);

  /**console.log("Vector size =>", vectorSize);
  console.log("Embeddings =>", embeddings);

  await upsertChunkEmbeddings(
    embeddings.map((embedding, index) => ({
      chunkId: `test-chunk-${index}`,
      documentId: "test-document",
      vector: embedding,
    })),
  );

  const query = "Quels types d'encre utilise-t-on en imprimerie ?";

  const [queryEmbedding] = await provider.embed({
    model: "qwen3-embedding:4b",
    chunks: [query],
  });

  const results = await searchSimilarChunks(queryEmbedding, 3);

  console.log("Query =>", query);
  console.log("Results =>", results);**/

  return (
    <pre>
      hey !
    </pre>
  );
}
