import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";

import { decryptToken, encryptToken } from "./encryption";

describe("encryption of the tokens and API keys", () => {
    const key = randomBytes(32);

    it("decrypts what it encrypted, with a new IV each time", () => {
        const token = "1//0gRefreshToken-éà";
        const first = encryptToken(token, key);

        assert.equal(decryptToken(first, key), token);
        assert.notEqual(encryptToken(token, key), first);
        assert.ok(!first.includes("RefreshToken"));
    });

    it("rejects another key and an altered value", () => {
        const encrypted = encryptToken("token", key);
        const altered = Buffer.from(encrypted, "base64");
        altered[altered.length - 1] ^= 1;

        assert.throws(() => decryptToken(encrypted, randomBytes(32)));
        assert.throws(() => decryptToken(altered.toString("base64"), key));
    });
});
