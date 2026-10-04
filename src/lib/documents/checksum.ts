import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function calculateFileChecksum(
  path: string,
): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

export async function calculateFileChecksumFromStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const hash = createHash("sha256");
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }

  return hash.digest("hex");
}