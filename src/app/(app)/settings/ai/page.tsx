import { getProvidersWithModels } from "@/lib/queries/aiProvider";

import { AISettings } from "@/components/settings/ai/ai-settings";

export default async function AISettingsPage() {
  const providers = await getProvidersWithModels();

  return <AISettings providers={providers} />;
}