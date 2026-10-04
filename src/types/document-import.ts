export type DocumentImportFile = {
  key: string;
  displayName: string;
  format: string;
  fileSize: number;
  checksum: string;
  relativePath?: string;
  conflict: {
    documentId: string;
    displayName: string;
    checksum: string;
  } | null;
};

export type DocumentImportIgnoredFile = {
  key: string;
  displayName: string;
  relativePath?: string;
  reason: "UNSUPPORTED_FORMAT" | "DUPLICATE";
};

export type DocumentImportConflict = {
  documentId: string;
  displayName: string;
  checksum: string;
};

export type DocumentImportAnalysis = {
  files: DocumentImportFile[];
  ignored: DocumentImportIgnoredFile[];
};

export type DocumentImportConflictAction =
  | "IGNORE"
  | "REPLACE";

export type DocumentImportDecision = {
  key: string;
  action: DocumentImportConflictAction;
};

export type DocumentImportRequest = {
  decisions: DocumentImportDecision[];
  indexImmediately: boolean;
};