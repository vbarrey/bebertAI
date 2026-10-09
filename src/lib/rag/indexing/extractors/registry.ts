import { PdfExtractor } from "./pdf-extractor";
import { DocxExtractor } from "./docx-extractor";
import { TextExtractor } from "./text-extractor";
import { ImageExtractor } from "./image-extractor";
import type { ExtractionParameters } from "@/lib/pipeline/parameters";

export const extractors = {
  PDF: (parameters: ExtractionParameters) => new PdfExtractor(parameters),
  DOCX: () => new DocxExtractor(),
  TXT: () => new TextExtractor(),
  PNG: (parameters: ExtractionParameters) => new ImageExtractor(parameters),
  JPEG: (parameters: ExtractionParameters) => new ImageExtractor(parameters),
} as const;
