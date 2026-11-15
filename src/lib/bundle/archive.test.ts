import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

import { BundleError, header, headerSize, packBundle, unpackBundle, verifyBundle } from "./archive";
import { BUNDLE_FORMAT_VERSION, type BundleManifest } from "./format";

let root: string;
before(async () => { root = await mkdtemp(path.join(tmpdir(), "bebert-bundle-")); });
after(() => rm(root, { recursive: true, force: true }));

const limits = { maxBytes: 1_000_000, maxEntries: 100 };
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const checksum = "a".repeat(64);
let count = 0;
const fresh = () => path.join(root, `case-${++count}`);

function manifest(files: Record<string, string>): BundleManifest {
    return {
        formatVersion: BUNDLE_FORMAT_VERSION,
        appVersion: "0.2.0",
        exportedAt: "2026-11-15T10:00:00.000Z",
        selection: { kind: "all", label: "Tout" },
        filesIncluded: "local",
        counts: { documents: 1, chunks: 1, files: 1 },
        embedding: { providerType: "OLLAMA_LOCAL", model: "qwen3-embedding:4b-q8_0", dimension: 2 },
        sparse: { k: 1.2, b: 0.75, asciiFolding: true },
        extraction: { ocrEnabled: true, ocrMinCharsPerPage: 50, ocrLanguages: ["fra", "eng"] },
        chunking: { chunkSize: 2000, chunkOverlap: 200 },
        driveAccounts: [],
        sha256: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, sha256(content)])),
    };
}

/** A bundle directory with these files and their manifest. */
async function bundleDirectory(files: Record<string, string>, change?: (manifest: BundleManifest) => void) {
    const directory = fresh();
    await mkdir(path.join(directory, "files"), { recursive: true });
    for (const [name, content] of Object.entries(files)) await writeFile(path.join(directory, name), content);
    const written = manifest(files);
    change?.(written);
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify(written));
    return directory;
}

/** A gzipped tar made by hand, to send what packBundle never writes. */
async function rawArchive(entries: { name: string; content: string; type?: string; size?: number }[]) {
    const blocks = entries.flatMap(({ name, content, type, size }) => {
        const block = header(name, size ?? Buffer.byteLength(content));
        if (type) {
            block.write(type, 156, "ascii");
            block.fill(" ", 148, 156);
            block.write(block.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
        }
        const data = Buffer.from(content);
        return [block, data, Buffer.alloc((512 - (data.length % 512)) % 512)];
    });
    const file = path.join(root, `raw-${++count}.bebert`);
    await writeFile(file, gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)])));
    return file;
}

describe("bundle archive", () => {
    const files = { "documents.ndjson": "{}\n", "chunks.ndjson": "{}\n", "vectors.f32": "\0\0\0\0\0\0\0\0", [`files/${checksum}`]: "%PDF" };

    it("packs, unpacks and verifies a bundle", async () => {
        const archive = path.join(root, "round.bebert");
        await packBundle(await bundleDirectory(files), archive);

        const target = fresh();
        await unpackBundle(archive, target, limits);
        const read = await verifyBundle(target);

        assert.equal(read.embedding.model, "qwen3-embedding:4b-q8_0");
        assert.equal(await readFile(path.join(target, "files", checksum), "utf8"), "%PDF");
    });

    it("is read by a standard tar", async () => {
        const archive = path.join(root, "standard.bebert");
        await packBundle(await bundleDirectory(files), archive);

        // Run from the archive's directory: GNU tar on Windows takes "C:" for a remote host.
        const listing = execFileSync("tar", ["-tzf", path.basename(archive)], { cwd: root, encoding: "utf8" });
        assert.deepEqual(listing.trim().split(/\r?\n/).sort(), ["chunks.ndjson", "documents.ndjson", `files/${checksum}`, "manifest.json", "vectors.f32"]);
    });

    it("encodes sizes beyond 8 GiB in base 256", () => {
        assert.equal(headerSize(header("vectors.f32", 10 * 1024 ** 3)), 10 * 1024 ** 3);
        assert.equal(headerSize(header("vectors.f32", 1234)), 1234);
    });

    it("refuses paths out of the format", async () => {
        for (const name of ["../evil", "files/../../evil", "/etc/passwd", "files/ABC", "other.json"]) {
            await assert.rejects(unpackBundle(await rawArchive([{ name, content: "x" }]), fresh(), limits), /Entrée inattendue/, name);
        }
    });

    it("refuses links, directories and duplicates", async () => {
        await assert.rejects(unpackBundle(await rawArchive([{ name: "manifest.json", content: "", type: "2" }]), fresh(), limits), /pas un fichier ordinaire/);
        await assert.rejects(unpackBundle(await rawArchive([{ name: "manifest.json", content: "", type: "5" }]), fresh(), limits), /pas un fichier ordinaire/);
        await assert.rejects(
            unpackBundle(await rawArchive([{ name: "manifest.json", content: "a" }, { name: "manifest.json", content: "b" }]), fresh(), limits),
            /en double/,
        );
    });

    it("refuses an archive over the limits before writing it", async () => {
        await assert.rejects(unpackBundle(await rawArchive([{ name: "vectors.f32", content: "x", size: 20 * 1024 ** 3 }]), fresh(), limits), /trop volumineux/);
        await assert.rejects(
            unpackBundle(await rawArchive([{ name: "manifest.json", content: "a" }, { name: "canary.json", content: "b" }]), fresh(), { ...limits, maxEntries: 1 }),
            /Trop d'entrées/,
        );
    });

    it("refuses a truncated or foreign archive", async () => {
        const archive = path.join(root, "truncated.bebert");
        await packBundle(await bundleDirectory(files), archive);
        const truncated = path.join(root, "cut.bebert");
        await writeFile(truncated, (await readFile(archive)).subarray(0, 100));
        await assert.rejects(unpackBundle(truncated, fresh(), limits), BundleError);

        const foreign = path.join(root, "foreign.bebert");
        await writeFile(foreign, "PK\x03\x04 not a tar.gz");
        await assert.rejects(unpackBundle(foreign, fresh(), limits), /Archive illisible/);
    });

    it("refuses a file changed, missing or not listed", async () => {
        const changed = await bundleDirectory(files);
        await writeFile(path.join(changed, "chunks.ndjson"), "{\"changed\":true}\n");
        await assert.rejects(verifyBundle(changed), /sha256 différent\) : chunks.ndjson/);

        const missing = await bundleDirectory(files);
        await rm(path.join(missing, "vectors.f32"));
        await assert.rejects(verifyBundle(missing), /manquant dans le paquet : vectors.f32/);

        const extra = await bundleDirectory(files);
        await writeFile(path.join(extra, "canary.json"), "{}");
        await assert.rejects(verifyBundle(extra), /absent du manifeste : canary.json/);
    });

    it("tells a bundle of a newer format", async () => {
        const newer = await bundleDirectory(files, (written) => { (written as { formatVersion: number }).formatVersion = 2; });
        await assert.rejects(verifyBundle(newer), /format 2, que cette version de BebertAI ne sait pas lire/);
    });
});
