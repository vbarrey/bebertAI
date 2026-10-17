import { connection } from "next/server";

import { PipelineSettings } from "@/components/settings/pipeline/PipelineSettings";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";

export default async function PipelineSettingsPage() {
  // Rendered per request: installed OCR languages can change without a rebuild.
  await connection();

  const [pipelineConfig, providers, ocrLanguages] = await Promise.all([
    pipelineRuntime.getConfig(),
    // Like the chat model selector: the disabled providers and models are not offered.
    getEnableProvidersWithModels(),
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