# Streamed Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local and Google Drive imports go file by file through a browser-side queue, followed in a side panel, with conflicts settled per line or by a rule.

**Architecture:** A `useImportQueue` hook in `DocumentImportPopover` owns the queue; each item is hashed (browser or Drive metadata), checked against `/api/documents/import/check`, then imported alone through the existing import routes. The analyze routes and the review/conflict dialogs go away.

**Tech Stack:** Next.js route handlers, React 19, Prisma, zod, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-11-21-streamed-import-design.md`

## Global Constraints

- UI copy in French; code comments in English, never tagged "ponytail:".
- 3 items processed at once; an item waiting on a conflict holds no slot.
- Max file size: `MAX_FILE_SIZE` from `src/lib/documents/upload-limits.ts` (100 Mo).
- Conflict decision key: `getImportDecisionKey(checksum, displayName)` from `src/lib/documents/import.ts`.
- Text cut with "…" uses `TruncatedText`.

## Review Focus

- The same file twice in one import (or a Drive file inside a picked folder also picked): imported once, the other line "déjà dans cet import".
- A conflict appearing between the check and the import (409): the line goes back to the check, not to an error.
- Closing the dialog mid-import: the queue keeps running, the panel floats on the page.
- "Ignorer" from a project: the existing document joins the project's selection (routes already do it).
- Drive file with no `sha256Checksum`: falls back to the per-file checksum route.

---

### Task 1: Pure queue helpers

**Files:**
- Create: `src/lib/documents/import-queue.ts`, `src/lib/documents/import-queue.test.ts`

**Interfaces — Produces:**
- `type ImportStep = "queued" | "hashing" | "checking" | "conflict" | "uploading" | "indexing" | "done" | "skipped" | "error"`
- `type ConflictRule = "ASK" | "IGNORE" | "REPLACE"`
- `ACTIVE_STEPS: ImportStep[]` = hashing, checking, uploading
- `nextToStart(items: { id: string; step: ImportStep }[], max: number): string[]` — queued ids, in order, up to `max - active`.
- `isQueueDuplicate(items: { id: string; checksum?: string; step: ImportStep }[], id: string, checksum: string): boolean` — an earlier item, not skipped/error, has that checksum.
- `formatSize(bytes: number): string` — French, "84,3 Mo" / "512 Ko".

- [ ] Tests: `nextToStart` with 1 active + 4 queued, max 3 → first 2 queued ids; conflict items count as inactive. `isQueueDuplicate` true for an earlier same checksum, false when that one is skipped. `formatSize(84.3*1024*1024)` → "84,3 Mo".
- [ ] Run `npx tsx --test src/lib/documents/import-queue.test.ts` → FAIL, implement, → PASS. Commit.

### Task 2: Server routes

**Files:**
- Create: `src/app/api/documents/import/check/route.ts`, `src/app/api/google-drive/folder-files/route.ts`, `src/app/api/google-drive/import/checksum/route.ts`
- Modify: `src/lib/google-drive/client.ts` (`FILE_FIELDS` + `sha256Checksum`, `DriveItem.checksum: string | null`)
- Delete: `src/app/api/documents/import/analyze/route.ts`, `src/app/api/google-drive/import/analyze/route.ts`

**Interfaces — Produces:**
- `POST /api/documents/import/check` `{ checksums: string[] (hex64, max 500) }` → `{ conflicts: Record<string, { documentId: string; displayName: string }> }`
- `GET /api/google-drive/folder-files?id=` → `{ files: (DriveItem & { relativePath: string })[] }`; 401 on `GoogleDriveAuthError`, 404 on Drive 404.
- `POST /api/google-drive/import/checksum` `{ fileId }` → `{ checksum }`

- [ ] Implement; `npx tsc --noEmit` passes once Task 3 removes the old clients (run at end of Task 3). Commit with Task 3.

### Task 3: Queue hook, panel, dialogs

**Files:**
- Create: `src/components/documents/useImportQueue.ts`, `src/components/documents/ImportQueuePanel.tsx`
- Modify: `DocumentPopover.tsx`, `LocalDocumentImportDialog.tsx`, `GoogleDriveImportDialog.tsx`, `src/types/document-import.ts`
- Delete: `DocumentImportReview.tsx`, `DocumentImportConflictDialog.tsx`

**Interfaces — Produces:**
- `useImportQueue({ addDocuments, onIndexingStarted, projectId })` → `{ items, rule, setRule, indexImmediately, setIndexImmediately, addLocal(files: { file: File; relativePath?: string }[]), addDrive(files: (DriveItem & { relativePath?: string })[]), decide(id, action), decideAll(action), clearFinished() }`
- `ImportQueuePanel({ queue, floating?: boolean })`

- [ ] Hook: scheduler effect with `nextToStart(items, 3)`; local hash `crypto.subtle.digest`, upload via XHR (progress) to `/api/documents/import` with one file; Drive via `/api/google-drive/import` with one file; IGNORE without project → "skipped" without a server call; 409 → back to "queued" without decision; own `EventSource` on its job ids; `beforeunload` while items are queued/active/conflict.
- [ ] Dialogs: "Importer" calls `addLocal`/`addDrive` and clears the selection; rule select + "Indexer maintenant" in the dialog; right column with the panel when the queue is not empty. Drive: selection total size, folder size fetched on check (`calcul…` / "37 fichiers · 52,1 Mo"), total "au moins" while computing.
- [ ] Popover: floating panel bottom-right when no dialog is open and the queue is not empty.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` pass; manual check in the browser (local + Drive, conflict, closing the dialog). Commit; `graphify update .`.
