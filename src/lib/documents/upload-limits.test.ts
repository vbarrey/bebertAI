import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_FILE_SIZE, MAX_UPLOAD_SIZE, uploadLimitError, uploadTooLarge } from "./upload-limits";

describe("upload limits", () => {
  it("accepts files under the limits", () => {
    assert.equal(uploadLimitError([{ name: "a.pdf", size: MAX_FILE_SIZE }, { name: "b.pdf", size: 1 }]), null);
  });

  it("names the files over the file limit", () => {
    assert.match(uploadLimitError([{ name: "gros.pdf", size: MAX_FILE_SIZE + 1 }, { name: "petit.pdf", size: 1 }])!, /gros\.pdf\.$/);
  });

  it("refuses files over the total limit", () => {
    const files = Array.from({ length: 4 }, (_, index) => ({ name: `${index}.pdf`, size: MAX_UPLOAD_SIZE / 4 + 1 }));
    assert.match(uploadLimitError(files)!, /en plusieurs fois/);
  });

  it("refuses a request announcing more than the total limit, before reading it", () => {
    const request = (length: number) => new Request("http://localhost/api/documents/import", { method: "POST", headers: { "content-length": String(length) } });

    assert.equal(uploadTooLarge(request(MAX_UPLOAD_SIZE)), false);
    assert.equal(uploadTooLarge(request(MAX_UPLOAD_SIZE * 2)), true);
  });
});
