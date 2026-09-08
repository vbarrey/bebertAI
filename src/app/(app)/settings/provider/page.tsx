import { getProvidersWithModels } from "@/lib/queries/aiProvider";

import { ProvidersSettings } from "@/components/settings/providers/providers-settings";

export default async function AISettingsPage() {
  const providers = await getProvidersWithModels();

  return <ProvidersSettings providers={providers} />;
}