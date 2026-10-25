import type { Metadata } from "next";
import { getProvidersWithModels } from "@/lib/queries/aiProvider";

import { ProvidersSettings } from "@/components/settings/providers/providers-settings";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Fournisseurs et modèles" };

export default async function AISettingsPage() {
  const user = await requireUser();
  const providers = await getProvidersWithModels(user);

  return <ProvidersSettings providers={providers} />;
}