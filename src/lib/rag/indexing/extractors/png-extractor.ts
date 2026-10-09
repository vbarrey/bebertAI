import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { Document } from "@prisma/client";

import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../../types";
import { buildImageBlocks, getDocumentPath, type ImageMetadata } from "../indexing-utils";

// PNG text keywords written by people (not by the encoder).
const LABELS: Record<string, string> = {
  Title: "Titre",
  Description: "Description",
  Comment: "Commentaire",
  Keywords: "Mots-clés",
};

/**
 * Reads the tEXt / zTXt / iTXt chunks. A truncated or corrupt file returns what was read so far.
 */
export function readPngMetadata(buffer: Buffer): ImageMetadata {
  const metadata: ImageMetadata = [];

  try {
    // 8-byte signature, then chunks: length (4) + type (4) + data + CRC (4).
    for (let offset = 8; offset + 8 <= buffer.length;) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString("latin1", offset + 4, offset + 8);
      const data = buffer.subarray(offset + 8, offset + 8 + length);
      offset += 12 + length;

      if (type === "IEND") {
        break;
      }

      if (type !== "tEXt" && type !== "zTXt" && type !== "iTXt") {
        continue;
      }

      const keywordEnd = data.indexOf(0);
      const label = LABELS[data.toString("latin1", 0, keywordEnd)];

      if (keywordEnd < 0 || !label) {
        continue;
      }

      const rest = data.subarray(keywordEnd + 1);

      if (type === "tEXt") {
        metadata.push([label, rest.toString("latin1")]);
      } else if (type === "zTXt") {
        // Compression method byte, then zlib data.
        metadata.push([label, inflateSync(rest.subarray(1)).toString("latin1")]);
      } else {
        // Compression flag, method, language tag \0, translated keyword \0, UTF-8 text.
        const compressed = rest[0] === 1;
        const languageEnd = rest.indexOf(0, 2);
        const textStart = rest.indexOf(0, languageEnd + 1) + 1;
        const text = rest.subarray(textStart);

        metadata.push([label, (compressed ? inflateSync(text) : text).toString("utf8")]);
      }
    }
  } catch {
    // Unreadable metadata: the file name is still indexed.
  }

  return metadata;
}

export class PngExtractor implements DocumentExtractor {
  async extract(
    document: Document,
  ): Promise<ExtractedDocument> {
    const metadata = readPngMetadata(await readFile(getDocumentPath(document)));

    return {
      blocks: buildImageBlocks(document.displayName, metadata),
      language: document.language ?? undefined,
    };
  }
}
