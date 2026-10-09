import { readFile } from "node:fs/promises";
import { Document } from "@prisma/client";

import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../../types";
import { buildImageBlocks, getDocumentPath, type ImageMetadata } from "../indexing-utils";

// EXIF IFD0 tags written by people (Windows Explorer for the XP* ones). Camera, dates and GPS are left out.
const EXIF_LABELS: Record<number, string> = {
  0x9c9b: "Titre",
  0x010e: "Description",
  0x9c9f: "Objet",
  0x9c9c: "Commentaire",
  0x9c9e: "Mots-clés",
};

const IMAGE_DESCRIPTION = 0x010e;

// The encoding of COM and ImageDescription is not specified: UTF-8 when valid, Latin-1 otherwise.
function decodeText(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return bytes.toString("latin1");
  }
}

function readExif(tiff: Buffer, metadata: ImageMetadata) {
  const littleEndian = tiff.toString("latin1", 0, 2) === "II";
  const u16 = (offset: number) => littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const u32 = (offset: number) => littleEndian ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);

  const ifd = u32(4);

  for (let index = 0; index < u16(ifd); index++) {
    const entry = ifd + 2 + index * 12;
    const tag = u16(entry);
    const label = EXIF_LABELS[tag];

    if (!label) {
      continue;
    }

    // ASCII and BYTE values: the count is the size in bytes, stored inline up to 4 bytes.
    const size = u32(entry + 4);
    const start = size <= 4 ? entry + 8 : u32(entry + 8);
    const value = tiff.subarray(start, start + size);

    // XP* tags are UTF-16LE whatever the TIFF byte order.
    metadata.push([label, tag === IMAGE_DESCRIPTION ? decodeText(value) : value.toString("utf16le")]);
  }
}

/**
 * Reads the COM segment and the EXIF text tags. A truncated or corrupt file returns what was read so far.
 */
export function readJpgMetadata(buffer: Buffer): ImageMetadata {
  const metadata: ImageMetadata = [];

  try {
    // SOI, then segments: 0xFF marker + length (2, including itself) + data, until the image data (SOS).
    for (let offset = 2; offset + 4 <= buffer.length;) {
      const marker = buffer.readUInt16BE(offset);

      if (marker === 0xffda || marker === 0xffd9) {
        break;
      }

      const length = buffer.readUInt16BE(offset + 2);
      const data = buffer.subarray(offset + 4, offset + 2 + length);
      offset += 2 + length;

      if (marker === 0xfffe) {
        metadata.push(["Commentaire", decodeText(data)]);
      } else if (marker === 0xffe1 && data.toString("latin1", 0, 6) === "Exif\0\0") {
        readExif(data.subarray(6), metadata);
      }
    }
  } catch {
    // Unreadable metadata: the file name is still indexed.
  }

  return metadata;
}

export class JpgExtractor implements DocumentExtractor {
  async extract(
    document: Document,
  ): Promise<ExtractedDocument> {
    const metadata = readJpgMetadata(await readFile(getDocumentPath(document)));

    return {
      blocks: buildImageBlocks(document.displayName, metadata),
      language: document.language ?? undefined,
    };
  }
}
