import type { DocumentFormat } from "@/lib/pipeline/formats";

export type DocumentImportFile = {
  key: string;
  filename: string;
  displayName: string;
  format: DocumentFormat;
  fileSize: number;
  checksum: string;
  relativePath?: string;
  conflict: DocumentImportConflict | null;
};

export type DocumentImportConflict = {
  documentId: string;
  displayName: string;
  checksum: string;
};

export type DocumentImportIgnoredFile = {
  key: string;
  filename: string;
  relativePath?: string;
  reason: "UNSUPPORTED_FORMAT" | "DUPLICATE";
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