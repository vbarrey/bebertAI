/**
 * Contains One-Time functions only call at start-up.
 * The register function will be called once when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests.
 */

import { initializeAI } from "@/lib/startup/initialize-ai";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

export async function register() {
  console.log(`[Launch One-Time functions]`);
  await initializeAI();
  console.log(`[Finish all One-Time functions]`);

  console.log(`[Initialize pipeline configuration]`);
  await pipelineRuntime.initialize();
}