
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function calculateFileChecksum(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}