import { z } from "zod";

export const DocumentFormatSchema = z.enum([
  "PDF",
  "TXT",
  "DOCX",
]);

export type DocumentFormat = z.infer<
  typeof DocumentFormatSchema
>;

export function getDocumentFormat(
  filename: string,
): DocumentFormat | null {
  const extension = filename.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf":
      return "PDF";
    case "txt":
      return "TXT";
    case "docx":
      return "DOCX";
    default:
      return null;
  }
}