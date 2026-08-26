export type IndexingProgress =
  | {
      stage: "EXTRACTING";
      current?: number;
      total?: number;
    }
  | {
      stage: "CHUNKING";
    }
  | {
      stage: "PERSISTING";
    };