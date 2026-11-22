"use client";

import { useEffect, useRef, useState } from "react";
import { JobStatus, type Document } from "@prisma/client";

import type { IndexingSteps } from "@/lib/queue/types";
import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { getDocumentFormat, type DocumentFormat } from "@/lib/documents/format";
import { MAX_FILE_SIZE } from "@/lib/documents/upload-limits";
import { isQueueDuplicate, nextToStart, type ConflictRule, type ImportStep } from "@/lib/documents/import-queue";
import type { DriveItem } from "@/lib/google-drive/client";
import type { DocumentImportConflictAction } from "@/types/document-import";

// Files hashed, checked or sent at once.
const CONCURRENCY = 3;

export type ImportItem = {
  id: string;
  name: string;
  relativePath?: string;
  size: number | null;
  source:
    | { kind: "local"; file: File }
    // checksum: given by Drive, null when it gives none (computed by the server then).
    // format: null when not supported (the item is skipped at once).
    | { kind: "drive"; fileId: string; format: DocumentFormat | null; checksum: string | null };
  indexImmediately: boolean;
  step: ImportStep;
  // Set once the file claimed it in the queue: another file with it is the same file twice.
  checksum?: string;
  // Sending, 0 to 1.
  progress?: number;
  conflict?: { documentId: string; displayName: string };
  decision?: DocumentImportConflictAction;
  // The result or the error of a finished item.
  message?: string;
  jobId?: string;
  // The worker's last progress, while indexed.
  indexing?: IndexingSteps;
};

type ImportResult = { importedDocuments: Document[]; createdJobIds: string[] };

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const PENDING_STEPS: ImportStep[] = ["queued", "hashing", "checking", "conflict", "uploading"];
const FINISHED_STEPS: ImportStep[] = ["done", "skipped", "error"];

export const isPending = (item: ImportItem) => PENDING_STEPS.includes(item.step);
export const isFinished = (item: ImportItem) => FINISHED_STEPS.includes(item.step);

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HttpError(response.status, data.error ?? "Une erreur est survenue.");
  }

  return data;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// XMLHttpRequest rather than fetch: it tells how much of the file is sent.
function uploadLocal(body: FormData, onProgress: (progress: number) => void): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", "/api/documents/import");
    request.responseType = "json";
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    request.onerror = () => reject(new HttpError(0, "Connexion au serveur perdue."));
    request.onload = () => request.status < 400
      ? resolve(request.response)
      : reject(new HttpError(request.status, request.response?.error ?? "L'import a échoué."));
    request.send(body);
  });
}

type Options = {
  addDocuments: (documents: Document[]) => void;
  onIndexingStarted: (jobId: string) => void;
  // Imported for this project: a document already there joins its selection.
  projectId?: string;
};

/**
 * The files being imported, each on its own: checksum, check against the documents already there, conflict, sending,
 * indexing. Kept by the page, not by the dialog: closing it does not stop the import.
 */
export function useImportQueue({ addDocuments, onIndexingStarted, projectId }: Options) {
  // The ref is the queue as it is now, for the imports under way; the state renders it.
  const itemsRef = useRef<ImportItem[]>([]);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [rule, setRuleState] = useState<ConflictRule>("ASK");
  const ruleRef = useRef<ConflictRule>("ASK");
  const [indexImmediately, setIndexImmediately] = useState(true);
  // Started and not yet back in the queue: an effect run twice does not start them twice.
  const started = useRef(new Set<string>());

  function commit(next: ImportItem[]) {
    itemsRef.current = next;
    setItems(next);
  }

  function update(id: string, patch: Partial<ImportItem>) {
    commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function setRule(next: ConflictRule) {
    ruleRef.current = next;
    setRuleState(next);
  }

  function add(newItems: ImportItem[]) {
    commit([...itemsRef.current, ...newItems]);
  }

  function base(name: string, relativePath: string | undefined, size: number | null) {
    return {
      id: crypto.randomUUID(),
      name,
      relativePath: relativePath && relativePath !== name ? relativePath : undefined,
      size,
      indexImmediately,
      step: "queued" as ImportStep,
    };
  }

  function addLocal(files: { file: File; relativePath?: string }[]) {
    add(files.map(({ file, relativePath }) => {
      const item = { ...base(file.name, relativePath, file.size), source: { kind: "local" as const, file } };
      const format = getDocumentFormat(file.name, file.type);

      if (!format || !pipelineCapabilities.import.supportedFormat.includes(format)) {
        return { ...item, step: "skipped", message: "Format non pris en charge" };
      }

      if (file.size > MAX_FILE_SIZE) {
        return { ...item, step: "error", message: `Plus de ${MAX_FILE_SIZE / 1024 / 1024} Mo` };
      }

      return item;
    }));
  }

  function addDrive(files: (DriveItem & { relativePath?: string })[]) {
    add(files.map((file) => {
      const item = {
        ...base(file.name, file.relativePath, file.size),
        source: { kind: "drive" as const, fileId: file.id, format: file.format, checksum: file.checksum },
      };

      return file.format ? item : { ...item, step: "skipped" as ImportStep, message: "Format non pris en charge" };
    }));
  }

  async function importItem(item: ImportItem, checksum: string, decision?: DocumentImportConflictAction): Promise<ImportResult> {
    // Keyed as getImportDecisionKey does on the server (its module is server only).
    const decisions = decision ? { [`${checksum}:${item.name}`]: decision } : {};

    if (item.source.kind === "drive") {
      return postJson<ImportResult>("/api/google-drive/import", {
        files: [{
          sourceRef: item.source.fileId,
          displayName: item.name,
          format: item.source.format,
          fileSize: item.size ?? 0,
          checksum,
        }],
        decisions,
        indexImmediately: item.indexImmediately,
        projectId,
      });
    }

    const body = new FormData();
    body.append("files", item.source.file);
    body.append("relativePaths", item.relativePath ?? "");
    body.append("decisions", JSON.stringify(decisions));
    body.append("indexImmediately", String(item.indexImmediately));

    if (projectId) {
      body.append("projectId", projectId);
    }

    return uploadLocal(body, (progress) => update(item.id, { progress }));
  }

  async function run(id: string) {
    const item = itemsRef.current.find((candidate) => candidate.id === id)!;
    let checksum = item.checksum ?? (item.source.kind === "drive" ? item.source.checksum : null);

    try {
      if (!checksum) {
        update(id, { step: "hashing" });
        checksum = item.source.kind === "local"
          ? await sha256(item.source.file)
          : (await postJson<{ checksum: string }>("/api/google-drive/import/checksum", { fileId: item.source.fileId })).checksum;
      }

      if (isQueueDuplicate(itemsRef.current, id, checksum)) {
        update(id, { step: "skipped", message: "Déjà dans cet import" });
        return;
      }

      update(id, { step: "checking", checksum });
      let decision = item.decision;

      if (!decision) {
        const { conflicts } = await postJson<{ conflicts: Record<string, ImportItem["conflict"]> }>(
          "/api/documents/import/check",
          { checksums: [checksum] },
        );
        const conflict = conflicts[checksum];

        if (conflict) {
          if (ruleRef.current === "ASK") {
            update(id, { step: "conflict", conflict });
            return;
          }

          decision = ruleRef.current;
          update(id, { conflict, decision });
        }
      }

      // Nothing to send: the document already there stays as it is. From a project, the server adds it to its selection.
      if (decision === "IGNORE" && !projectId) {
        update(id, { step: "skipped", message: "Déjà présent, ignoré" });
        return;
      }

      update(id, { step: "uploading", progress: 0 });
      const result = await importItem(item, checksum, decision);

      addDocuments(result.importedDocuments);
      const [jobId] = result.createdJobIds;

      if (jobId) {
        onIndexingStarted(jobId);
        update(id, { step: "indexing", jobId });
      } else {
        update(id, {
          step: "done",
          message: decision === "IGNORE" ? "Déjà présent, ajouté au projet" : decision === "REPLACE" ? "Remplacé" : "Importé",
        });
      }
    } catch (error) {
      // Imported by another request since the check: back to the check, which finds the conflict.
      if (error instanceof HttpError && error.status === 409) {
        update(id, { step: "queued", decision: undefined });
        return;
      }

      update(id, {
        step: "error",
        message: error instanceof HttpError && error.status === 401 && item.source.kind === "drive"
          ? "Google Drive déconnecté"
          : error instanceof Error ? error.message : "Une erreur est survenue.",
      });
    } finally {
      // Back in the queue (a conflict decided, a 409), it can start again.
      started.current.delete(id);
    }
  }

  useEffect(() => {
    for (const id of nextToStart(items, CONCURRENCY)) {
      if (!started.current.has(id)) {
        started.current.add(id);
        void run(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a change of the queue alone starts the next files.
  }, [items]);

  // The indexing of the imported files, on its own connection: the page follows only its documents.
  const indexingJobsKey = items
    .filter((item) => item.step === "indexing" && item.jobId)
    .map((item) => item.jobId)
    .join(",");

  useEffect(() => {
    if (!indexingJobsKey) {
      return;
    }

    const eventSource = new EventSource(`/api/indexing-jobs/events?ids=${indexingJobsKey}`);

    eventSource.addEventListener("progress", (event) => {
      const { jobId, data } = JSON.parse(event.data) as { jobId: string; data: IndexingSteps };
      const item = itemsRef.current.find((candidate) => candidate.jobId === jobId);

      if (item?.step === "indexing") {
        update(item.id, { indexing: data });
      }
    });

    eventSource.addEventListener("status", (event) => {
      const data = JSON.parse(event.data) as { jobId: string; status: JobStatus; errorMessage?: string };
      const item = itemsRef.current.find((candidate) => candidate.jobId === data.jobId);

      if (!item) {
        return;
      }

      switch (data.status) {
        case JobStatus.COMPLETED:
          update(item.id, { step: "done", message: "Indexé" });
          break;
        case JobStatus.FAILED:
          update(item.id, { step: "error", message: data.errorMessage ?? "Échec de l'indexation" });
          break;
        case JobStatus.CANCELLED:
          update(item.id, { step: "done", message: "Indexation annulée" });
      }
    });

    return () => eventSource.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the same jobs keep the same connection.
  }, [indexingJobsKey]);

  // Files not sent yet are lost with the page.
  const pending = items.some(isPending);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  function decide(id: string, action: DocumentImportConflictAction) {
    update(id, { step: "queued", decision: action });
  }

  function decideAll(action: DocumentImportConflictAction) {
    commit(itemsRef.current.map((item) => (item.step === "conflict" ? { ...item, step: "queued", decision: action } : item)));
  }

  function clearFinished() {
    commit(itemsRef.current.filter((item) => !isFinished(item)));
  }

  return {
    items,
    rule,
    setRule,
    indexImmediately,
    setIndexImmediately,
    addLocal,
    addDrive,
    decide,
    decideAll,
    clearFinished,
  };
}

export type ImportQueue = ReturnType<typeof useImportQueue>;
