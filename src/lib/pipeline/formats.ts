import { z } from "zod";

export const DocumentFormatSchema = z.enum([
  "PDF",
  "TXT",
  "DOCX",
]);

export type DocumentFormat = z.infer<
  typeof DocumentFormatSchema
>;