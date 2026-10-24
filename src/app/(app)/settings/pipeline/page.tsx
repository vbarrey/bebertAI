import { connection } from "next/server";

import { PipelineSettings } from "@/components/settings/pipeline/PipelineSettings";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";
import { requireUser } from "@/lib/session";

export default async function PipelineSettingsPage() {
  const user = await requireUser();

  // Rendered per request: installed OCR languages can change without a rebuild.
  await connection();

  const [pipelineConfig, providers, ocrLanguages] = await Promise.all([
    pipelineRuntime.getConfig(user.id),
    // Like the chat model selector: the disabled providers and models are not offered.
    getEnableProvidersWithModels(user.id),
    // No Tesseract: the form says so instead of failing the page.
    listInstalledOcrLanguages().catch(() => []),
  ]);

  return (
    <PipelineSettings
      initialConfig={pipelineConfig}
      providers={providers}
      ocrLanguages={ocrLanguages}
    />
  );
}