import "dotenv/config"; // needed for workers

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const BUSY_ATTEMPTS = 5;

// SQLITE_BUSY, which the adapter reports as a timeout (P1008).
export function isSqliteBusy(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1008";
}

/**
 * The app and the indexing worker write to the same file. A transaction that reads before it writes cannot take the
 * write lock once the other process wrote meanwhile: SQLite fails it at once, its busy timeout does not apply, and
 * the adapter starts every transaction with a plain BEGIN (no BEGIN IMMEDIATE). The interactive transactions are
 * run again then; their functions only touch the database. The batch ones start with a write: they wait their turn.
 */
function retryBusyTransactions(client: PrismaClient): PrismaClient {
  const transaction = client.$transaction.bind(client) as (...args: unknown[]) => Promise<unknown>;

  client.$transaction = (async (...args: unknown[]) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await transaction(...args);
      } catch (error) {
        if (typeof args[0] !== "function" || !isSqliteBusy(error) || attempt === BUSY_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 50 + Math.random() * 100));
      }
    }
  }) as PrismaClient["$transaction"];

  return client;
}

export function createPrismaClient(url = process.env["DATABASE_URL"]) {
  return retryBusyTransactions(new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    adapter: new PrismaBetterSqlite3({ url }),
  }));
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Not in WAL mode: Prisma's migrations take an exclusive lock, which WAL refuses while another process keeps the
// database open, so the app could no longer restart while the worker runs. A write waits for another one (5 s,
// better-sqlite3's default timeout) in the default journal mode too.
