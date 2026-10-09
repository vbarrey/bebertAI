import { PdfExtractor } from "./pdf-extractor";
import { DocxExtractor } from "./docx-extractor";
import { TextExtractor } from "./text-extractor";
import { PngExtractor } from "./png-extractor";
import { JpgExtractor } from "./jpg-extractor";
import type { ExtractionParameters } from "@/lib/pipeline/parameters";

export const extractors = {
  PDF: (parameters: ExtractionParameters) => new PdfExtractor(parameters),
  DOCX: () => new DocxExtractor(),
  TXT: () => new TextExtractor(),
  PNG: () => new PngExtractor(),
  JPEG: () => new JpgExtractor(),
} as const;
