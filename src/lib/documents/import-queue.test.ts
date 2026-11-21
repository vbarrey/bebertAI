import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSize, isQueueDuplicate, nextToStart } from "./import-queue";

describe("import queue", () => {
  it("starts queued items up to the free slots, a conflict holding none", () => {
    const items = [
      { id: "a", step: "uploading" as const },
      { id: "b", step: "conflict" as const },
      { id: "c", step: "queued" as const },
      { id: "d", step: "queued" as const },
      { id: "e", step: "queued" as const },
    ];

    assert.deepEqual(nextToStart(items, 3), ["c", "d"]);
  });

  it("finds another item under way claiming the same checksum, not a finished one", () => {
    const items = [
      { id: "a", step: "uploading" as const, checksum: "x" },
      { id: "d", step: "done" as const, checksum: "z" },
      { id: "b", step: "skipped" as const, checksum: "y" },
      { id: "c", step: "hashing" as const },
    ];

    assert.equal(isQueueDuplicate(items, "c", "x"), true);
    assert.equal(isQueueDuplicate(items, "c", "y"), false);
    assert.equal(isQueueDuplicate(items, "a", "x"), false);
    assert.equal(isQueueDuplicate(items, "c", "z"), false);
    assert.equal(isQueueDuplicate([{ id: "a", step: "hashing" }, { id: "b", step: "uploading", checksum: "x" }], "a", "x"), true);
  });

  it("formats sizes in French", () => {
    assert.equal(formatSize(84.3 * 1024 * 1024), "84,3 Mo");
    assert.equal(formatSize(512 * 1024), "512 Ko");
  });
});
