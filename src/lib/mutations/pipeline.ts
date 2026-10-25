"use server";

import type { PipelineParameters } from "@/lib/pipeline/parameters";
import { updatePipelineParameters } from "@/lib/pipeline/runtime";
import { requireUser } from "@/lib/session";

/**
 * The parameters saved, or why they were refused. Any value can be sent to a server action: they are validated by
 * updatePipelineParameters.
 */
export async function savePipelineParameters(parameters: unknown): Promise<{ parameters: PipelineParameters } | { error: string }> {
  const user = await requireUser();

  try {
    return { parameters: (await updatePipelineParameters(user.id, parameters)).parameters };
  } catch (error) {
    // Returned: a thrown error only reaches the browser as a generic message in production.
    return { error: error instanceof Error ? error.message : "Impossible d'enregistrer les paramètres du pipeline." };
  }
}
