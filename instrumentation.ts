/**
 * Contains One-Time functions only call at start-up.
 * The register function will be called once when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests.
 */

export async function register() {
  // This file is also bundled for the Edge runtime: Node-only modules (Prisma, OCR CLI) are loaded for Node only.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { initializeAI } = await import("@/lib/startup/initialize-ai");
  const { pipelineRuntime } = await import("@/lib/pipeline/runtime");

  console.log(`[Launch One-Time functions]`);
  await initializeAI();
  console.log(`[Finish all One-Time functions]`);

  console.log(`[Initialize pipeline configuration]`);
  await pipelineRuntime.initialize();
}