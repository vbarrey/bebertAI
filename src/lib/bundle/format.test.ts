import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CanarySchema, ChunkLineSchema, DocumentLineSchema, isBundleEntryName, vectorBytes } from "./format";

const checksum = "b".repeat(64);
const document = {
    checksum,
    displayName: "Manuel.pdf",
    format: "PDF",
    fileSize: 1200,
    language: "french",
    sourceType: "LOCAL",
    sourceRef: null,
    driveAccount: null,
    file: `files/${checksum}`,
};

describe("bundle format", () => {
    it("names the entries of the format only", () => {
        assert.ok(isBundleEntryName("manifest.json"));
        assert.ok(isBundleEntryName(`files/${checksum}`));
        assert.ok(!isBundleEntryName("files/../manifest.json"));
        assert.ok(!isBundleEntryName("files/"));
    });

    it("needs the file of a local document, the file or the link of a Drive one", () => {
        assert.ok(DocumentLineSchema.safeParse(document).success);
        assert.ok(!DocumentLineSchema.safeParse({ ...document, file: null }).success);
        assert.ok(DocumentLineSchema.safeParse({ ...document, sourceType: "GOOGLE_DRIVE", sourceRef: "1AbC", driveAccount: "a@b.fr", file: null }).success);
        assert.ok(!DocumentLineSchema.safeParse({ ...document, sourceType: "GOOGLE_DRIVE", file: null }).success);
    });

    it("refuses a file path out of files/", () => {
        assert.ok(!DocumentLineSchema.safeParse({ ...document, file: "../../etc/passwd" }).success);
    });

    it("reads a chunk line", () => {
        const chunk = { document: checksum, position: 0, text: "Le moteur", pageNumber: 3, language: "french", x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
        assert.ok(ChunkLineSchema.safeParse(chunk).success);
        assert.ok(!ChunkLineSchema.safeParse({ ...chunk, position: -1 }).success);
    });

    it("needs one canary vector per text", () => {
        assert.ok(CanarySchema.safeParse({ texts: ["a", "b"], vectors: [[1], [2]] }).success);
        assert.ok(!CanarySchema.safeParse({ texts: ["a", "b"], vectors: [[1]] }).success);
    });

    it("stores a vector as float32 little-endian", () => {
        const bytes = vectorBytes([1, -0.5]);
        assert.equal(bytes.length, 8);
        assert.equal(bytes.readFloatLE(0), 1);
        assert.equal(bytes.readFloatLE(4), -0.5);
    });
});
