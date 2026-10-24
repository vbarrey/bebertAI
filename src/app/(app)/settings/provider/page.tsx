import { getProvidersWithModels } from "@/lib/queries/aiProvider";

import { ProvidersSettings } from "@/components/settings/providers/providers-settings";
import { requireAdmin } from "@/lib/session";

export default async function AISettingsPage() {
  // Shared by every user until each one has their own (phase 4).
  await requireAdmin();

  const providers = await getProvidersWithModels();

  return <ProvidersSettings providers={providers} />;
}