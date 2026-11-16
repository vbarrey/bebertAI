"use client";

import { useEffect, useRef, useState } from "react";

import {
  DOCUMENTS_MAX_LIMIT,
  DOCUMENTS_PAGE_SIZE,
  documentPageSearchParams,
  type DocumentListQuery,
} from "@/lib/documents/list-query";
import type { DocumentRow, DocumentsPage } from "@/lib/queries/document";

type Loading = "idle" | "more" | "replace";

// JSON turns the dates into strings: back to the Date the server rendering gives.
function reviveDates(document: DocumentRow): DocumentRow {
  return {
    ...document,
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
    indexedAt: document.indexedAt && new Date(document.indexedAt),
  };
}

async function fetchPage(query: DocumentListQuery, offset: number, limit: number, signal: AbortSignal): Promise<DocumentsPage> {
  const response = await fetch(`/api/documents?${documentPageSearchParams({ ...query, offset, limit })}`, { signal });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erreur ${response.status}`);
  }

  const page = (await response.json()) as DocumentsPage;
  return { ...page, documents: page.documents.map(reviveDates) };
}

/**
 * The documents of the page, loaded slice by slice in the order and with the filters of `query`.
 *
 * One request at a time: a new one cancels the one under way, whose answer would no longer match the list. The list
 * is always the beginning of the sorted documents: a change of query starts it again, `reload` fetches again everything
 * already loaded, in a single request, after the documents changed.
 */
export function useDocumentList(query: DocumentListQuery, initial: DocumentsPage) {
  const [documents, setDocuments] = useState(initial.documents);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState<Loading>("idle");
  const [error, setError] = useState<string | null>(null);

  const controller = useRef<AbortController | null>(null);
  // Read by the callbacks, which outlive the rendering that created them.
  const latest = useRef({ query, count: documents.length });
  useEffect(() => {
    latest.current = { query, count: documents.length };
  });

  async function load(mode: Exclude<Loading, "idle">, offset: number, limit: number): Promise<boolean> {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(mode);
    setError(null);

    try {
      const page = await fetchPage(latest.current.query, offset, limit, current.signal);

      setDocuments((loaded) => {
        if (mode === "replace") return page.documents;
        // Imported meanwhile, a document shifts the slices by one: never twice in the list.
        const ids = new Set(loaded.map((document) => document.id));
        return [...loaded, ...page.documents.filter((document) => !ids.has(document.id))];
      });
      setTotal(page.total);
      return true;
    } catch (caught) {
      if (current.signal.aborted) return false;
      setError(caught instanceof Error ? caught.message : "Le chargement des documents a échoué.");
      return false;
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setLoading("idle");
      }
    }
  }

  // A new sort or filter: the list starts again from its beginning. Not at the first rendering: the server gave it.
  const queryKey = JSON.stringify(query);
  const shownQueryKey = useRef(queryKey);
  useEffect(() => {
    if (queryKey === shownQueryKey.current) return;
    shownQueryKey.current = queryKey;
    void load("replace", 0, DOCUMENTS_PAGE_SIZE);
  }, [queryKey]);

  useEffect(() => () => controller.current?.abort(), []);

  const hasMore = documents.length < total;

  return {
    documents,
    total,
    hasMore,
    loading,
    error,
    /** The next slice, unless one is loading or none remains. */
    loadMore() {
      if (loading !== "idle" || !hasMore) return;
      void load("more", documents.length, DOCUMENTS_PAGE_SIZE);
    },
    /** Everything already loaded again: true once the list holds the documents as they are now. */
    reload() {
      const count = Math.min(Math.max(latest.current.count, DOCUMENTS_PAGE_SIZE), DOCUMENTS_MAX_LIMIT);
      return load("replace", 0, count);
    },
    /** Deleted: gone at once, before the reload confirms it. */
    remove(documentIds: string[]) {
      const removed = new Set(documentIds);
      setDocuments((loaded) => loaded.filter((document) => !removed.has(document.id)));
      setTotal((count) => Math.max(count - documentIds.length, 0));
    },
  };
}
