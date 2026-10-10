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

// Shown in the indexing progress card and prefixed to error messages so the UI tells which step failed.
export const INDEXING_STAGE_LABELS: Partial<Record<IndexingStage, string>> = {
  [IndexingStage.CREATING]: "Préparation",
  [IndexingStage.EXTRACTING]: "Extraction du texte",
  [IndexingStage.CHUNKING]: "Découpage",
  [IndexingStage.PERSISTING_CHUNKS]: "Enregistrement des chunks",
  [IndexingStage.EMBEDDING]: "Embedding (Ollama)",
  [IndexingStage.PERSISTING_EMBEDDINGS]: "Enregistrement des vecteurs (Qdrant)",
  [IndexingStage.COMPLETED]: "Terminé",
};

// Stages the worker goes through, in order: each one is an equal share of the progress bar.
const PROGRESS_STAGES = [
  IndexingStage.CREATING,
  IndexingStage.EXTRACTING,
  IndexingStage.CHUNKING,
  IndexingStage.PERSISTING_CHUNKS,
  IndexingStage.EMBEDDING,
  IndexingStage.PERSISTING_EMBEDDINGS,
];

/** Progress of an indexing job in percent, the OCR pages done filling the extraction share. */
export function indexingProgressPercent({ stage, current, total }: IndexingSteps): number {
  if (stage === IndexingStage.COMPLETED) {
    return 100;
  }

  const index = PROGRESS_STAGES.indexOf(stage);

  if (index < 0) {
    return 0;
  }

  const withinStage = total ? Math.min(current ?? 0, total) / total : 0;

  return Math.round(((index + withinStage) / PROGRESS_STAGES.length) * 100);
}
