import { connection } from "next/server";

import { PipelineSettings } from "@/components/settings/pipeline/PipelineSettings";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getProvidersWithModels } from "@/lib/queries/aiProvider";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";

export default async function PipelineSettingsPage() {
  // Rendered per request: installed OCR languages can change without a rebuild.
  await connection();

  const [pipelineConfig, providers, ocrLanguages] = await Promise.all([
    pipelineRuntime.getConfig(),
    getProvidersWithModels(),
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