/**
 * Contains One-Time functions only call at start-up.
 * The register function will be called once when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests.
 */

export async function register() {
  // This file is also bundled for the Edge runtime: Node-only modules (Prisma, OCR CLI) are loaded for Node only.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Better Auth refuses its default secret in production: stop at start-up rather than fail on every page.
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET doit être défini (32 caractères ou plus : openssl rand -base64 32).");
  }

  const { initializeAI } = await import("@/lib/startup/initialize-ai");
  const { pipelineRuntime } = await import("@/lib/pipeline/runtime");

  console.log(`[Launch One-Time functions]`);
  await initializeAI();
  console.log(`[Finish all One-Time functions]`);

  console.log(`[Initialize pipeline configuration]`);
  await pipelineRuntime.initialize();

  const { inviteFirstAdmin } = await import("@/lib/invitations");

  await inviteFirstAdmin().catch((error) => console.error("Invitation du premier administrateur impossible :", error));
}