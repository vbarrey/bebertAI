import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { deflateSync } from "node:zlib";
import type { Document } from "@prisma/client";

import { PngExtractor, readPngMetadata } from "./png-extractor";
import { JpgExtractor, readJpgMetadata } from "./jpg-extractor";
import { buildImageBlocks } from "../indexing-utils";
import { RecursiveCharacterChunker } from "../chunkers/RecursiveChunker";

/*
 * Files are built in memory: only the bytes the readers look at are meaningful (CRCs are left at 0).
 */
function png(chunks: [type: string, data: Buffer][]): Buffer {
    return Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        ...[...chunks, ["IEND", Buffer.alloc(0)] as [string, Buffer]].map(([type, data]) => {
            const header = Buffer.alloc(8);
            header.writeUInt32BE(data.length);
            header.write(type, 4, "latin1");
            return Buffer.concat([header, data, Buffer.alloc(4)]);
        }),
    ]);
}

const latin1 = (text: string) => Buffer.from(text, "latin1");

// Big-endian TIFF with one IFD; values longer than 4 bytes go after the IFD.
function exif(entries: [tag: number, type: number, value: Buffer][]): Buffer {
    const ifdSize = 2 + entries.length * 12 + 4;
    const ifd = Buffer.alloc(ifdSize);
    const values: Buffer[] = [];
    let valueOffset = 8 + ifdSize;

    ifd.writeUInt16BE(entries.length);
    entries.forEach(([tag, type, value], index) => {
        const entry = 2 + index * 12;
        ifd.writeUInt16BE(tag, entry);
        ifd.writeUInt16BE(type, entry + 2);
        ifd.writeUInt32BE(value.length, entry + 4);

        if (value.length <= 4) {
            value.copy(ifd, entry + 8);
        } else {
            ifd.writeUInt32BE(valueOffset, entry + 8);
            values.push(value);
            valueOffset += value.length;
        }
    });

    return Buffer.concat([latin1("Exif\0\0MM\0\x2a\0\0\0\x08"), ifd, ...values]);
}

function jpg(segments: [marker: number, data: Buffer][]): Buffer {
    return Buffer.concat([
        Buffer.from("ffd8", "hex"),
        ...segments.map(([marker, data]) => {
            const header = Buffer.alloc(4);
            header.writeUInt16BE(marker);
            header.writeUInt16BE(data.length + 2, 2);
            return Buffer.concat([header, data]);
        }),
        Buffer.from("ffda000201ffd9", "hex"),
    ]);
}

const ASCII = 2;
const BYTE = 1;

describe("buildImageBlocks", () => {
    it("turns the file name into words and keeps the original name", () => {
        assert.deepEqual(buildImageBlocks("char_renault-FT.1917.jpg", []), [{
            text: "Image : char renault FT 1917\nFichier : char_renault-FT.1917.jpg",
        }]);
    });

    it("adds non-empty metadata once", () => {
        assert.deepEqual(
            buildImageBlocks("a.png", [["Titre", "Char FT\0"], ["Description", "Char FT"], ["Commentaire", "  "]]),
            [{ text: "Image : a\nFichier : a.png\nTitre : Char FT" }],
        );
    });
});

describe("readPngMetadata", () => {
    it("reads tEXt, zTXt and iTXt text chunks written by people", () => {
        const file = png([
            ["IHDR", Buffer.alloc(13)],
            ["tEXt", latin1("Title\0Char Renault FT")],
            ["tEXt", latin1("Software\0GIMP 2.10")],
            ["zTXt", Buffer.concat([latin1("Description\0\0"), deflateSync(latin1("Vue de profil, 1917"))])],
            ["iTXt", Buffer.concat([latin1("Keywords\0\0\0fr\0Mots-clés\0"), Buffer.from("blindé, char", "utf8")])],
            ["iTXt", Buffer.concat([latin1("Comment\0\x01\0\0\0"), deflateSync(Buffer.from("Archive militaire", "utf8"))])],
        ]);

        assert.deepEqual(readPngMetadata(file), [
            ["Titre", "Char Renault FT"],
            ["Description", "Vue de profil, 1917"],
            ["Mots-clés", "blindé, char"],
            ["Commentaire", "Archive militaire"],
        ]);
    });

    it("keeps what was read before a corrupt chunk", () => {
        const file = png([["tEXt", latin1("Title\0Char")], ["zTXt", latin1("Comment\0\0pas du zlib")]]);

        assert.deepEqual(readPngMetadata(file), [["Titre", "Char"]]);
        assert.deepEqual(readPngMetadata(Buffer.from("pas une image")), []);
    });
});

describe("readJpgMetadata", () => {
    it("reads the comment and the EXIF text tags, not the camera ones", () => {
        const file = jpg([
            [0xffe0, latin1("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")],
            [0xffe1, exif([
                [0x010f, ASCII, latin1("Canon\0")],
                [0x010e, ASCII, Buffer.from("Char Renault FT\0", "utf8")],
                [0x0132, ASCII, latin1("2024:01:01 10:00:00\0")],
                [0x9c9b, BYTE, Buffer.from("Char Renault FT\0", "utf16le")],
                [0x9c9e, BYTE, Buffer.from("blindé; 1917\0", "utf16le")],
            ])],
            [0xfffe, latin1("Photographie d'archive é")],
        ]);

        assert.deepEqual(readJpgMetadata(file), [
            ["Description", "Char Renault FT\0"],
            ["Titre", "Char Renault FT\0"],
            ["Mots-clés", "blindé; 1917\0"],
            ["Commentaire", "Photographie d'archive é"],
        ]);
    });

    it("returns nothing for a file without metadata or a corrupt one", () => {
        assert.deepEqual(readJpgMetadata(jpg([])), []);
        assert.deepEqual(readJpgMetadata(jpg([[0xffe1, latin1("Exif\0\0MM\0\x2a\xff\xff\xff\xff")]])), []);
    });
});

describe("image extractors", () => {
    const STORAGE = process.env.DOCUMENTS_STORAGE_PATH ?? "./data/documents";
    const directory = mkdtemp(path.join(tmpdir(), "bebert-images-"));

    after(async () => rm(await directory, { recursive: true, force: true }));

    // getDocumentPath() resolves storagePath against the storage folder.
    async function document(name: string, content: Buffer): Promise<Document> {
        const filePath = path.join(await directory, name);
        await writeFile(filePath, content);

        return {
            id: name,
            displayName: name,
            storagePath: path.relative(STORAGE, filePath),
            language: null,
        } as Document;
    }

    it("indexes a PNG as one chunk without page or bounds", async () => {
        const extraction = await new PngExtractor().extract(
            await document("plan_moteur_celtaquatre.png", png([["tEXt", latin1("Title\0Moteur Celtaquatre")]])),
        );

        const chunks = await new RecursiveCharacterChunker({ chunkSize: 1000, chunkOverlap: 200 }).chunk(extraction);

        assert.deepEqual(chunks.map(({ text, pageNumber, bounds }) => ({ text, pageNumber, bounds })), [{
            text: "Image : plan moteur celtaquatre\nFichier : plan_moteur_celtaquatre.png\nTitre : Moteur Celtaquatre",
            pageNumber: undefined,
            bounds: undefined,
        }]);
    });

    it("indexes a JPEG from its name when it has no metadata", async () => {
        const { blocks } = await new JpgExtractor().extract(await document("IMG_0042.jpeg", jpg([])));

        assert.deepEqual(blocks, [{ text: "Image : IMG 0042\nFichier : IMG_0042.jpeg" }]);
    });
});
