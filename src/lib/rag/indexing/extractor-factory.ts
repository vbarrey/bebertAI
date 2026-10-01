import { DocumentExtractor, UnsupportedDocumentTypeError } from "../types";
import { DocumentFormat } from "@/lib/pipeline/formats";
import { extractors } from "./extractors/registry";

export function getDocumentExtractor(
  format: DocumentFormat,
): DocumentExtractor {
  const factory = extractors[format];

  if (!factory) {
    throw new UnsupportedDocumentTypeError(format);
  }

  return factory();
}