import type { DocumentFormat } from "@/lib/pipeline/formats";

const mimeTypesToFormat: Record<string, DocumentFormat> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
};

const extensionsToFormat: Record<string, DocumentFormat> = {
  ".pdf": "PDF",
  ".docx": "DOCX",
  ".txt": "TXT",
};

export function getDocumentFormat(
  filename: string,
  mimeType: string,
): DocumentFormat | null {
  const mimeFormat = mimeTypesToFormat[mimeType];

  if (mimeFormat) {
    return mimeFormat;
  }

  const extension = filename
    .slice(filename.lastIndexOf("."))
    .toLowerCase();

  return extensionsToFormat[extension] ?? null;
}