/**
 * Contains One-Time functions only call at start-up.
 * The register function will be called once when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests.
 */

export async function register() {
  // This file is also bundled for the Edge runtime: Node-only modules (Prisma, OCR CLI) are loaded for Node only.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Every environment variable checked, and the ones production cannot run without.
  const { checkProductionEnv } = await import("@/lib/env");
  checkProductionEnv();

  const { initializeAI } = await import("@/lib/startup/initialize-ai");
  const { adoptLegacyChunksCollection } = await import("@/lib/qdrant/collections");

  console.log(`[Launch One-Time functions]`);
  await initializeAI();
  console.log(`[Finish all One-Time functions]`);

  // Qdrant down: tried again at the next start.
  await adoptLegacyChunksCollection().catch((error) => console.error("Reprise de la collection Qdrant impossible :", error));

  const { inviteFirstAdmin } = await import("@/lib/invitations");

  await inviteFirstAdmin().catch((error) => console.error("Invitation du premier administrateur impossible :", error));
}