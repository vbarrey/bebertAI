import { MimeType } from "@prisma/client";
import { DocumentExtractor, UnsupportedDocumentTypeError } from "../types";
import { PdfExtractor } from "./extractors/pdf-extractor";
import { DocxExtractor } from "./extractors/docx-extractor";
import { TextExtractor } from "./extractors/text-extractor";

export function getDocumentExtractor(
  mimeType: string
): DocumentExtractor {
  switch (mimeType) {
    case "PDF":
      return new PdfExtractor();
    case "DOCX":
      return new DocxExtractor();
    case "TXT":
      return new TextExtractor();
    default:
      throw new UnsupportedDocumentTypeError(mimeType);
  }
}
