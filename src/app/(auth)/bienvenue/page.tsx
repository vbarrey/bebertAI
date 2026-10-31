import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { needsOnboarding } from "@/lib/onboarding";
import { getProvidersWithModels } from "@/lib/queries/aiProvider";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function WelcomePage() {
  const user = await requireUser();

  if (!(await needsOnboarding(user.id))) redirect("/");

  return <OnboardingWizard providers={await getProvidersWithModels(user)} />;
}
