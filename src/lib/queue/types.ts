export enum IndexingStage {
  CREATING = "CREATING",
  EXTRACTING = "EXTRACTING",
  CHUNKING = "CHUNKING",
  PERSISTING_CHUNKS = "PERSISTING_CHUNKS",
  EMBEDDING = "EMBEDDING",
  PERSISTING_EMBEDDINGS = "PERSISTING_EMBEDDINGS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export type IndexingSteps = {
  stage: IndexingStage;
  current?: number;
  total?: number;
};