// Never in a browser bundle: importing it from a Client Component fails the build.
import "server-only";

// Loaded by the app and the indexing worker, which reads the .env itself (Next.js does for the app).
import "dotenv/config";

import { z } from "zod";

/**
 * The environment variables of the app and the worker, read here only, with their defaults. Checked when this
 * module loads: a wrong value stops the start-up with its name instead of misbehaving later. The ones required in
 * production only (BETTER_AUTH_SECRET, the encryption key) are checked at the start of the server: the build loads
 * this module without them.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.url().optional(),
  // The first admin invited, without any account yet.
  ADMIN_EMAIL: z.email().optional(),

  // Read by Better Auth itself; here for the production check.
  BETTER_AUTH_SECRET: z.string().optional(),
  // The providers' API keys and the Google Drive tokens; GOOGLE_TOKEN_ENCRYPTION_KEY is its former name.
  ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().optional(),

  DATABASE_URL: z.string().default("file:./data/database/bebertai.db"),
  DOCUMENTS_STORAGE_PATH: z.string().default("./data/documents"),
  // The .bebert bundles being exported or imported (src/lib/bundle), deleted after a day.
  BUNDLES_PATH: z.string().default("./data/bundles"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  QDRANT_URL: z.url().default("http://localhost:6333"),
  // Ollama on this machine (http://localhost:11434): unset, the "Ollama local" provider is not offered.
  OLLAMA_URL: z.url().optional(),

  // Documents extracted at once (CPU: text, OCR), and embedded at once (GPU with Ollama; more with a remote API).
  INDEXING_CPU_SLOTS: z.coerce.number().int().positive().default(2),
  INDEXING_GPU_SLOTS: z.coerce.number().int().positive().default(1),
  // Tesseract processes for the whole worker. Unset: every core but two, left to the app.
  INDEXING_OCR_THREADS: z.coerce.number().int().positive().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),

  // Without SMTP_HOST, the emails (invitations, password resets) go to the logs.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // The sender, "Bebert AI <noreply@domain>"; SMTP_USER by default.
  EMAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const KNOWN = Object.keys(EnvSchema.shape);

/**
 * The variables set under a known name in another case, such as ADMIN_EMAIl: Windows reads them anyway, Linux does
 * not, and the app goes on without them.
 */
export function misspelledVariables(source: Record<string, string | undefined>): string[] {
  return Object.keys(source).flatMap((name) => {
    const known = KNOWN.find((key) => key !== name && key.toUpperCase() === name.toUpperCase());
    return known ? [`${name} (attendu : ${known})`] : [];
  });
}

/** The variables checked, or an error naming each wrong one. Empty values count as unset, as in the .env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const set = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const parsed = EnvSchema.safeParse(set);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`);
    throw new Error(`Variables d'environnement invalides :\n- ${issues.join("\n- ")}`);
  }

  return parsed.data;
}

export const env = parseEnv(process.env);

const misspelled = misspelledVariables(process.env);

if (misspelled.length > 0) {
  console.warn(`Variables d'environnement mal orthographiées, ignorées hors Windows : ${misspelled.join(", ")}.`);
}

/** At the start of the server: what production cannot run without. */
export function checkProductionEnv() {
  if (env.NODE_ENV !== "production") return;

  // Better Auth refuses its default secret in production: stop at start-up rather than fail on every page.
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET doit être défini (32 caractères ou plus : openssl rand -base64 32).");
  }

  // The providers' API keys and the Google Drive tokens are stored encrypted with it.
  if (!env.ENCRYPTION_KEY && !env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY doit être défini (openssl rand -base64 32), et ne plus changer : les clés API stockées en dépendent.");
  }
}
