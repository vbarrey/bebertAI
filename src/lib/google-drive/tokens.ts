import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
    const key = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "", "base64");

    if (key.length !== 32) {
        throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY doit contenir 32 octets encodés en base64.");
    }

    return key;
}

/**
 * AES-256-GCM, stored as base64 of IV (12 bytes) + auth tag (16 bytes) + ciphertext.
 */
export function encryptToken(token: string, key = encryptionKey()): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);

    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

// Throws when the value was altered or encrypted with another key.
export function decryptToken(value: string, key = encryptionKey()): string {
    const data = Buffer.from(value, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));

    decipher.setAuthTag(data.subarray(12, 28));

    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}
