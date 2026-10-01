import { PipelineSettings } from "@/components/settings/pipeline/PipelineSettings";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getProvidersWithModels } from "@/lib/queries/aiProvider";

export default async function PipelineSettingsPage() {
  const [pipelineConfig, providers] = await Promise.all([
    pipelineRuntime.getConfig(),
    getProvidersWithModels(),
  ]);

  return (
    <PipelineSettings
      initialConfig={pipelineConfig}
      providers={providers}
    />
  );
}