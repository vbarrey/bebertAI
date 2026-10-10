import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapWithConcurrency } from "./concurrency";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
    it("keeps the input order and never exceeds the limit", async () => {
        let running = 0;
        let maxRunning = 0;

        const results = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async (ms, index) => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await sleep(ms);
            running--;
            return index * 10;
        });

        assert.deepEqual(results, [0, 10, 20, 30, 40]);
        assert.equal(maxRunning, 2);
    });

    it("starts no new call after a failure", async () => {
        const started: number[] = [];

        await assert.rejects(
            mapWithConcurrency([1, 2, 3, 4, 5], 1, async (item) => {
                started.push(item);
                if (item === 2) throw new Error("boom");
            }),
            /boom/,
        );

        assert.deepEqual(started, [1, 2]);
    });

    it("handles an empty list", async () => {
        assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
    });
});
