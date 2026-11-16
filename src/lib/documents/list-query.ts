// What the documents page asks for: its filters, its sort and the slice of the list it lacks. Shared by the page, which
// writes it into the URL of /api/documents, and by the route, which reads it back.

import { z } from "zod";
import { IndexingStatus } from "@prisma/client";

// Loaded at once, then again each time the end of the list comes near.
export const DOCUMENTS_PAGE_SIZE = 50;
// The documents already loaded are fetched again in a single request after an action: as many as a long scroll.
export const DOCUMENTS_MAX_LIMIT = 1000;

// The columns the table sorts on. Not the status: its filter already groups the documents by status.
export const documentSortColumns = ["displayName", "format", "fileSize", "language", "indexedAt", "updatedAt", "createdAt"] as const;
export type DocumentSortColumn = (typeof documentSortColumns)[number];

export const documentListQuerySchema = z.object({
  search: z.string().trim().max(200).default(""),
  status: z.union([z.literal("ALL"), z.enum(IndexingStatus)]).default("ALL"),
  // "LIBRARY", or the id of the project the documents were imported for.
  location: z.string().min(1).max(100).default("ALL"),
  // The newest first, as long as no column is sorted.
  sort: z.enum(documentSortColumns).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const documentPageQuerySchema = documentListQuerySchema.extend({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(DOCUMENTS_MAX_LIMIT).default(DOCUMENTS_PAGE_SIZE),
});

export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type DocumentPageQuery = z.infer<typeof documentPageQuerySchema>;

export const defaultDocumentListQuery: DocumentListQuery = documentListQuerySchema.parse({});

export function documentPageSearchParams(query: DocumentPageQuery) {
  return new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
}
