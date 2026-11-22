import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLimiter, mapWithConcurrency } from "./concurrency";

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

describe("createLimiter", () => {
    it("shares its slots between callers, first come first served, and frees them on failure", async () => {
        const limit = createLimiter(2);
        const started: number[] = [];
        let running = 0;
        let maxRunning = 0;

        const task = (id: number, ms: number, fail = false) => limit(async () => {
            started.push(id);
            running++;
            maxRunning = Math.max(maxRunning, running);
            await sleep(ms);
            running--;
            if (fail) throw new Error(`task ${id}`);
            return id;
        });

        const results = await Promise.allSettled([task(1, 20, true), task(2, 40), task(3, 5), task(4, 5)]);

        assert.equal(maxRunning, 2);
        assert.deepEqual(started, [1, 2, 3, 4]);
        assert.deepEqual(results.map((result) => result.status), ["rejected", "fulfilled", "fulfilled", "fulfilled"]);
        // The slots are free again.
        assert.equal(await limit(async () => "free"), "free");
    });
});
