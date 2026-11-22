/**
 * Maps the items with at most `limit` calls in flight, results in the input order.
 * After a failure no new call starts and the error is thrown; calls already running finish unawaited.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    let failed = false;

    const worker = async () => {
        while (!failed && next < items.length) {
            const index = next++;

            try {
                results[index] = await fn(items[index]!, index);
            } catch (error) {
                failed = true;
                throw error;
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));

    return results;
}

/**
 * A pool of `slots` shared by every caller: `run(fn)` waits for a free slot, first come first served, and frees it
 * when fn settles. Across the jobs of a process, unlike mapWithConcurrency which limits one call.
 */
export function createLimiter(slots: number) {
    let free = Math.max(1, slots);
    const waiting: (() => void)[] = [];

    return async function run<T>(fn: () => Promise<T>): Promise<T> {
        if (free > 0) {
            free--;
        } else {
            // Handed the slot of the caller that ends: free stays the same.
            await new Promise<void>((resolve) => waiting.push(resolve));
        }

        try {
            return await fn();
        } finally {
            const next = waiting.shift();

            if (next) {
                next();
            } else {
                free++;
            }
        }
    };
}
