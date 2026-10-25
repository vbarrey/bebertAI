/**
 * Restores a backup of scripts/backup.ts: the database, the stored documents and the Qdrant collections with their
 * aliases. Stop the app and the worker first: the database and the documents are replaced.
 * npx tsx scripts/restore.ts <backup directory>
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { QdrantClient } from "@qdrant/js-client-rest";

const DATABASE_PATH = (process.env.DATABASE_URL ?? "file:./data/database/bebertai.db").replace(/^file:/, "");
const DOCUMENTS_PATH = process.env.DOCUMENTS_STORAGE_PATH ?? "./data/documents";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";

const run = promisify(execFile);

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error("Usage : npx tsx scripts/restore.ts <dossier de sauvegarde>");

  // The journal files of the replaced database, if any, would be replayed on the restored one.
  await mkdir(path.dirname(DATABASE_PATH), { recursive: true });
  await Promise.all(["", "-wal", "-shm"].map((suffix) => rm(DATABASE_PATH + suffix, { force: true })));
  await copyFile(path.join(directory, "bebertai.db"), DATABASE_PATH);
  console.log(`Base restaurée : ${DATABASE_PATH}`);

  await rm(DOCUMENTS_PATH, { recursive: true, force: true });
  await mkdir(DOCUMENTS_PATH, { recursive: true });
  // Run from the backup directory, forward slashes: on Windows, GNU tar takes "C:" for a remote host and "\\" for escapes.
  await run("tar", ["-xzf", "documents.tar.gz", "-C", path.resolve(DOCUMENTS_PATH).replaceAll("\\", "/")], { cwd: directory });
  console.log(`Documents restaurés : ${DOCUMENTS_PATH} (${(await readdir(DOCUMENTS_PATH)).length} fichiers)`);

  // Each collection replaced by its snapshot, then the aliases recreated.
  const qdrant = new QdrantClient({ url: QDRANT_URL, checkCompatibility: false });
  for (const file of (await readdir(path.join(directory, "qdrant"))).filter((name) => name.endsWith(".snapshot"))) {
    const collection = file.slice(0, -".snapshot".length);
    const form = new FormData();
    form.append("snapshot", await openAsBlob(path.join(directory, "qdrant", file)), file);

    const response = await fetch(`${QDRANT_URL}/collections/${collection}/snapshots/upload?priority=snapshot&wait=true`, { method: "POST", body: form });
    if (!response.ok) throw new Error(`Restauration de la collection ${collection} : ${response.status} ${await response.text()}`);
    console.log(`Collection restaurée : ${collection} (${(await qdrant.count(collection, { exact: true })).count} points)`);
  }

  const aliases: { alias_name: string; collection_name: string }[] = JSON.parse(await readFile(path.join(directory, "qdrant", "aliases.json"), "utf8"));
  if (aliases.length > 0) {
    await qdrant.updateCollectionAliases({
      actions: aliases.map(({ alias_name, collection_name }) => ({ create_alias: { alias_name, collection_name } })),
    });
  }
  console.log(`Alias recréés : ${aliases.map((alias) => alias.alias_name).join(", ") || "aucun"}`);
}

main().catch((error) => {
  console.error("Restauration échouée :", error);
  process.exit(1);
});
