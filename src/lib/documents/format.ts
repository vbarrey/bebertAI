import { z } from "zod";

export const DocumentFormatSchema = z.enum([
  "PDF",
  "TXT",
  "DOCX",
]);

export type DocumentFormat = z.infer<
  typeof DocumentFormatSchema
>;

const MIME_TYPES_TO_FORMAT: Record<
  string,
  DocumentFormat
> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
};

const EXTENSIONS_TO_FORMAT: Record<
  string,
  DocumentFormat
> = {
  ".pdf": "PDF",
  ".docx": "DOCX",
  ".txt": "TXT",
};

export function getDocumentFormat(
  filename: string,
  mimeType?: string,
): DocumentFormat | null {
  if (mimeType) {
    const mimeFormat = MIME_TYPES_TO_FORMAT[mimeType];

    if (mimeFormat) {
      return mimeFormat;
    }
  }

  const extension = filename
    .slice(filename.lastIndexOf("."))
    .toLowerCase();

  return EXTENSIONS_TO_FORMAT[extension] ?? null;
}