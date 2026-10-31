"use server";

import { redirect } from "next/navigation";

import { completeOnboarding, skipOnboarding, type StepChoice } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";

export async function finishOnboarding(
  choice: { generation: StepChoice; embedding: StepChoice },
): Promise<{ error: string } | undefined> {
  const user = await requireUser();

  try {
    await completeOnboarding(user.id, choice);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Configuration impossible." };
  }
  redirect("/");
}

export async function postponeOnboarding(): Promise<void> {
  const user = await requireUser();
  await skipOnboarding(user.id);
  redirect("/");
}
