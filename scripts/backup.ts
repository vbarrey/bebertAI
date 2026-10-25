/**
 * Backs up the database, the stored documents and the Qdrant collections into BACKUP_PATH/<date>, then keeps the
 * 4 latest backups and the 2 latest Sunday ones. Safe while the app and the worker run.
 * Run every night by the backup service of docker compose; by hand: npx tsx scripts/backup.ts
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { promisify } from "node:util";

import { QdrantClient } from "@qdrant/js-client-rest";

import { prisma } from "@/lib/prisma";
import { backupsToDelete } from "@/lib/backups";

const BACKUP_PATH = process.env.BACKUP_PATH ?? "./data/backups";
const DOCUMENTS_PATH = process.env.DOCUMENTS_STORAGE_PATH ?? "./data/documents";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";

const run = promisify(execFile);

async function backUp(directory: string) {
  // A consistent copy of the database, taken while the other processes keep working.
  const databaseCopy = path.resolve(directory, "bebertai.db").replaceAll("\\", "/").replaceAll("'", "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${databaseCopy}'`);

  await mkdir(DOCUMENTS_PATH, { recursive: true });
  // Run from the backup directory, forward slashes: on Windows, GNU tar takes "C:" for a remote host and "\\" for escapes.
  await run("tar", ["-czf", "documents.tar.gz", "-C", path.resolve(DOCUMENTS_PATH).replaceAll("\\", "/"), "."], { cwd: directory });

  // One snapshot per collection, downloaded then deleted from Qdrant; the aliases to recreate them.
  const qdrant = new QdrantClient({ url: QDRANT_URL, checkCompatibility: false });
  await mkdir(path.join(directory, "qdrant"));

  for (const { name } of (await qdrant.getCollections()).collections) {
    const snapshot = await qdrant.createSnapshot(name, { wait: true });
    if (!snapshot) throw new Error(`Snapshot de la collection ${name} impossible.`);

    const response = await fetch(`${QDRANT_URL}/collections/${name}/snapshots/${snapshot.name}`);
    if (!response.ok || !response.body) throw new Error(`Téléchargement du snapshot de ${name} : ${response.status}`);
    await pipeline(Readable.fromWeb(response.body as ReadableStream<Uint8Array>), createWriteStream(path.join(directory, "qdrant", `${name}.snapshot`)));

    await qdrant.deleteSnapshot(name, snapshot.name);
  }

  await writeFile(path.join(directory, "qdrant", "aliases.json"), JSON.stringify((await qdrant.getAliases()).aliases, null, 2));
}

async function main() {
  const name = new Date().toISOString().slice(0, 10);
  const directory = path.join(BACKUP_PATH, name);

  // Run again the same day: the new backup replaces it.
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  try {
    await backUp(directory);
  } catch (error) {
    // A partial backup must not count as one, nor push a complete one out of the rotation.
    await rm(directory, { recursive: true, force: true });
    throw error;
  }

  for (const old of backupsToDelete(await readdir(BACKUP_PATH))) {
    await rm(path.join(BACKUP_PATH, old), { recursive: true, force: true });
  }

  const files = await readdir(directory, { recursive: true });
  const sizes = await Promise.all(files.map(async (file) => (await stat(path.join(directory, file))).size));
  console.log(`Sauvegarde ${directory} : ${(sizes.reduce((total, size) => total + size, 0) / 1024 / 1024).toFixed(1)} Mo. Gardées : ${(await readdir(BACKUP_PATH)).sort().join(", ")}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Sauvegarde échouée :", error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
