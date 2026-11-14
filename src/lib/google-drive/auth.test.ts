import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// A database of its own, created by the migrations: set before the modules reading the environment are loaded.
const directory = mkdtempSync(path.join(tmpdir(), "bebert-drive-auth-"));
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.GOOGLE_CLIENT_ID = "client";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google-drive/callback";
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

let prisma: typeof import("@/lib/prisma").prisma;
let auth: typeof import("./auth");

const idToken = `x.${Buffer.from(JSON.stringify({ email: "bob@example.com" })).toString("base64url")}.x`;

// Google's token endpoint answering with the scopes granted.
function googleGrants(scope: string) {
  globalThis.fetch = async () =>
    Response.json({ access_token: "access", refresh_token: "refresh", id_token: idToken, expires_in: 3600, scope });
}

before(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  auth = await import("./auth");
  await prisma.user.create({ data: { id: "user-bob", name: "bob", email: "bob@example.com" } });
});

after(async () => {
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

describe("Google Drive connection", () => {
  it("is refused, and not stored, when the access to the files was unticked", async () => {
    googleGrants("openid https://www.googleapis.com/auth/userinfo.email");
    await assert.rejects(auth.connectGoogleDrive("user-bob", "code"), { message: auth.NO_DRIVE_ACCESS });
    assert.equal(await prisma.googleDriveConnection.count(), 0);
  });

  it("is stored with the access to the files", async () => {
    googleGrants("openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.readonly");
    assert.equal(await auth.connectGoogleDrive("user-bob", "code"), "bob@example.com");
    assert.equal(await prisma.googleDriveConnection.count({ where: { userId: "user-bob" } }), 1);
  });
});
