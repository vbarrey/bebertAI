import { DocumentExtractor, UnsupportedDocumentTypeError } from "../types";
import { DocumentFormat } from "@/lib/documents/format";
import type { ExtractionParameters } from "@/lib/pipeline/parameters";
import { extractors } from "./extractors/registry";

export function getDocumentExtractor(
  format: DocumentFormat,
  parameters: ExtractionParameters,
): DocumentExtractor {
  const factory = extractors[format];

  if (!factory) {
    throw new UnsupportedDocumentTypeError(format);
  }

  return factory(parameters);
}