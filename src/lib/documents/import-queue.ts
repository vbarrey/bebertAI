// The steps of a file in the import queue, in order; conflict waits on the user, the last three are final.
export type ImportStep =
  | "queued"
  | "hashing"
  | "checking"
  | "conflict"
  | "uploading"
  | "indexing"
  | "done"
  | "skipped"
  | "error";

// What to do with a file already in the documents: ask on its line, or the same answer for all.
export type ConflictRule = "ASK" | "IGNORE" | "REPLACE";

// The steps that hold one of the queue's slots.
export const ACTIVE_STEPS: ImportStep[] = ["hashing", "checking", "uploading"];

/** The queued items to start now, in order, to fill the `max` slots. */
export function nextToStart(items: { id: string; step: ImportStep }[], max: number): string[] {
  const active = items.filter((item) => ACTIVE_STEPS.includes(item.step)).length;

  return items
    .filter((item) => item.step === "queued")
    .slice(0, Math.max(0, max - active))
    .map((item) => item.id);
}

/**
 * Another item under way claimed this checksum: the same file twice in the import. The first to finish its checksum
 * claims it, whatever its place in the queue. A finished one no longer does: imported, the check finds it.
 */
export function isQueueDuplicate(
  items: { id: string; checksum?: string; step: ImportStep }[],
  id: string,
  checksum: string,
): boolean {
  return items.some(
    (item) => item.id !== id && item.checksum === checksum && !["done", "skipped", "error"].includes(item.step),
  );
}

const sizeFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatSize(bytes: number): string {
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${sizeFormat.format(value)} ${units[unit]}`;
}
