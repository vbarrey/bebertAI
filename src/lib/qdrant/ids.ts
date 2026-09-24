import { v5 as uuidv5 } from "uuid";

const QDRANT_NAMESPACE = "b4042269-9ea0-4c5a-86b8-f82c4d8db187";

export function getQdrantPointId(chunkId: string): string {
  return uuidv5(chunkId, QDRANT_NAMESPACE);
}