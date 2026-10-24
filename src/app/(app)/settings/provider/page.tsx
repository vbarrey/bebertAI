import { getProvidersWithModels } from "@/lib/queries/aiProvider";

import { ProvidersSettings } from "@/components/settings/providers/providers-settings";
import { requireUser } from "@/lib/session";

export default async function AISettingsPage() {
  const user = await requireUser();
  const providers = await getProvidersWithModels(user);

  return <ProvidersSettings providers={providers} />;
}