/**
 * Writes and reads the .bebert archive: a gzipped tar of regular files only, streamed both ways (a bundle of a big
 * corpus holds gigabytes of vectors). Our own few lines of tar rather than a library: a bundle is untrusted, and
 * reading only what the format needs (no links, no directories, no paths but the fixed names) leaves nothing to
 * exploit.
 */
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

import { BundleManifestSchema, isBundleEntryName, MANIFEST_FILE, type BundleManifest } from "./format";

const BLOCK = 512;
// The largest size the 11 octal digits of a tar header hold (8 GiB): beyond, the base-256 encoding of GNU tar.
const OCTAL_SIZE_LIMIT = 8 ** 11;

export class BundleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BundleError";
    }
}

// Exported for the tests.
export function header(name: string, size: number): Buffer {
    const block = Buffer.alloc(BLOCK);
    block.write(name, 0, 100, "utf8");
    block.write("0000644\0", 100, "ascii");
    block.write("0000000\0", 108, "ascii");
    block.write("0000000\0", 116, "ascii");
    if (size < OCTAL_SIZE_LIMIT) {
        block.write(size.toString(8).padStart(11, "0") + "\0", 124, "ascii");
    } else {
        block[124] = 0x80;
        block.writeBigUInt64BE(BigInt(size), 128);
    }
    block.write("00000000000\0", 136, "ascii");
    block.write("0", 156, "ascii");
    block.write("ustar\0" + "00", 257, "ascii");
    // The checksum is computed with its own field as spaces.
    block.fill(" ", 148, 156);
    const checksum = block.reduce((sum, byte) => sum + byte, 0);
    block.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
    return block;
}

export function headerSize(block: Buffer): number {
    if (block[124]! & 0x80) {
        const size = block.readBigUInt64BE(128);
        if (block.subarray(125, 128).some((byte) => byte !== 0) || size > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new BundleError("Taille d'entrée invalide.");
        }
        return Number(size);
    }
    const octal = block.toString("ascii", 124, 136).replace(/[\0 ]+$/, "");
    if (!/^[0-7]{1,11}$/.test(octal)) throw new BundleError("Taille d'entrée invalide.");
    return parseInt(octal, 8);
}

function headerIsValid(block: Buffer): boolean {
    const stored = parseInt(block.toString("ascii", 148, 156).replace(/[\0 ]+$/, "").trim(), 8);
    const copy = Buffer.from(block);
    copy.fill(" ", 148, 156);
    return stored === copy.reduce((sum, byte) => sum + byte, 0);
}

const padding = (size: number) => (BLOCK - (size % BLOCK)) % BLOCK;

/** Every file of directory (its files/ folder included) into the archive, manifest first. */
export async function packBundle(directory: string, archive: string): Promise<void> {
    const files = await readdir(path.join(directory, "files")).then((names) => names.map((name) => `files/${name}`)).catch(() => []);
    const names = [MANIFEST_FILE, ...(await readdir(directory)).filter((name) => name !== MANIFEST_FILE && name !== "files"), ...files];

    async function* entries() {
        for (const name of names) {
            if (!isBundleEntryName(name)) throw new BundleError(`Fichier inattendu dans le paquet : ${name}`);
            const { size } = await stat(path.join(directory, name));
            yield header(name, size);
            yield* createReadStream(path.join(directory, name));
            yield Buffer.alloc(padding(size));
        }
        // End of archive: two empty blocks.
        yield Buffer.alloc(BLOCK * 2);
    }

    await pipeline(entries, createGzip(), createWriteStream(archive));
}

export type UnpackLimits = {
    // Decompressed: a small archive cannot fill the disk.
    maxBytes: number;
    maxEntries: number;
};

/**
 * Extracts the archive into directory (created, expected empty), refusing anything but the regular files of the
 * format, each name once, within the limits. Throws a BundleError naming what is wrong.
 */
export async function unpackBundle(archive: string, directory: string, limits: UnpackLimits): Promise<void> {
    await mkdir(path.join(directory, "files"), { recursive: true });

    const gunzip = createReadStream(archive).pipe(createGunzip());
    const chunks = gunzip[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
    let buffer = Buffer.alloc(0);

    const next = async () => {
        const { value, done } = await chunks.next().catch(() => {
            throw new BundleError("Archive illisible : ce n'est pas un paquet .bebert, ou il est abîmé.");
        });
        if (done) throw new BundleError("Archive incomplète : le téléchargement s'est peut-être arrêté en route.");
        buffer = Buffer.concat([buffer, value]);
    };
    const take = async (size: number) => {
        while (buffer.length < size) await next();
        const taken = buffer.subarray(0, size);
        buffer = buffer.subarray(size);
        return taken;
    };

    const seen = new Set<string>();
    let total = 0;

    try {
        while (true) {
            const block = await take(BLOCK);
            if (block.every((byte) => byte === 0)) break;
            if (!headerIsValid(block)) throw new BundleError("Archive abîmée : en-tête d'entrée invalide.");

            const name = block.toString("utf8", 0, 100).split("\0")[0]!;
            const type = block.toString("ascii", 156, 157);
            const size = headerSize(block);

            if (type !== "0" && type !== "\0") throw new BundleError(`Entrée refusée (pas un fichier ordinaire) : ${name}`);
            if (!isBundleEntryName(name)) throw new BundleError(`Entrée inattendue dans le paquet : ${name}`);
            if (seen.has(name)) throw new BundleError(`Entrée en double dans le paquet : ${name}`);
            seen.add(name);
            if (seen.size > limits.maxEntries) throw new BundleError(`Trop d'entrées dans le paquet (${limits.maxEntries} au plus).`);
            total += size;
            if (total > limits.maxBytes) throw new BundleError(`Paquet trop volumineux une fois décompressé (${limits.maxBytes} octets au plus).`);

            const out = createWriteStream(path.join(directory, name));
            try {
                let left = size;
                while (left > 0) {
                    if (buffer.length === 0) await next();
                    const part = buffer.subarray(0, Math.min(left, buffer.length));
                    buffer = buffer.subarray(part.length);
                    left -= part.length;
                    if (!out.write(part)) await once(out, "drain");
                }
                out.end();
                await once(out, "finish");
            } catch (error) {
                // Cut in the middle of this file: closed, the caller deletes the directory.
                out.destroy();
                throw error;
            }
            await take(padding(size));
        }
    } finally {
        gunzip.destroy();
    }
}

export async function sha256File(file: string): Promise<string> {
    const hash = createHash("sha256");
    await pipeline(createReadStream(file), hash);
    return hash.digest("hex");
}

/**
 * The manifest of an extracted bundle, once every file it lists is there with its sha256 and nothing else is.
 * Throws a BundleError otherwise.
 */
export async function verifyBundle(directory: string): Promise<BundleManifest> {
    const raw = await readFile(path.join(directory, MANIFEST_FILE), "utf8").catch(() => {
        throw new BundleError("Paquet sans manifeste.");
    });
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new BundleError("Manifeste illisible.");
    }
    const parsed = BundleManifestSchema.safeParse(json);
    if (!parsed.success) {
        const version = (json as { formatVersion?: unknown })?.formatVersion;
        throw new BundleError(typeof version === "number" && version !== 1
            ? `Paquet au format ${version}, que cette version de BebertAI ne sait pas lire.`
            : `Manifeste invalide : ${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join(" ; ")}`);
    }

    const manifest = parsed.data;
    const present = [
        ...(await readdir(directory)).filter((name) => name !== MANIFEST_FILE && name !== "files"),
        ...(await readdir(path.join(directory, "files")).catch(() => [])).map((name) => `files/${name}`),
    ];
    const listed = Object.keys(manifest.sha256);

    for (const name of present) {
        if (!(name in manifest.sha256)) throw new BundleError(`Fichier absent du manifeste : ${name}`);
    }
    for (const name of listed) {
        if (!present.includes(name)) throw new BundleError(`Fichier manquant dans le paquet : ${name}`);
        if (await sha256File(path.join(directory, name)) !== manifest.sha256[name]) {
            throw new BundleError(`Fichier abîmé (sha256 différent) : ${name}`);
        }
    }

    return manifest;
}
