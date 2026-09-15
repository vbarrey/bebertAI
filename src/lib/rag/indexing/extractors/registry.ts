import { PdfExtractor } from "./pdf-extractor";
import { DocxExtractor } from "./docx-extractor";
import { TextExtractor } from "./text-extractor";

export const extractors = {
  PDF: () => new PdfExtractor(),
  DOCX: () => new DocxExtractor(),
  TXT: () => new TextExtractor(),
} as const;
