import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { backupsToDelete } from "./backups";

// Every day of three weeks and a half, from Sunday 2026-10-04 to Wednesday 2026-10-28.
const days = Array.from({ length: 25 }, (_, index) => new Date(Date.UTC(2026, 9, 4 + index)).toISOString().slice(0, 10));

describe("backup rotation", () => {
  it("keeps the 4 latest backups and the 2 latest Sunday ones", () => {
    const deleted = backupsToDelete(days);
    const kept = days.filter((day) => !deleted.includes(day));

    // Sundays 2026-10-25 and 2026-10-18; the 4 latest days, 2026-10-25 among them.
    assert.deepEqual(kept, ["2026-10-18", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]);
  });

  it("deletes nothing while there are few backups, and never a directory of another name", () => {
    assert.deepEqual(backupsToDelete(["2026-10-27", "2026-10-28", "notes", "restored"]), []);
  });
});
