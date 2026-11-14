import type { Metadata } from "next";
import { connection } from "next/server";

import { PipelineSettings } from "@/components/settings/pipeline/PipelineSettings";
import { getPipelineConfig } from "@/lib/pipeline/runtime";
import { getEnableProvidersWithModels } from "@/lib/queries/aiProvider";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelineSettingsPage() {
  const user = await requireUser();

  // Rendered per request: installed OCR languages can change without a rebuild.
  await connection();

  const [pipelineConfig, generationProviders, embeddingProviders, ocrLanguages] = await Promise.all([
    getPipelineConfig(user.id),
    // Like the chat model selector: the disabled providers and models are not offered, and each step only offers
    // the models able to do it.
    getEnableProvidersWithModels(user.id, "GENERATION"),
    getEnableProvidersWithModels(user.id, "EMBEDDING"),
    // No Tesseract: the form says so instead of failing the page.
    listInstalledOcrLanguages().catch(() => []),
  ]);

  return (
    <PipelineSettings
      initialConfig={pipelineConfig}
      generationProviders={generationProviders}
      embeddingProviders={embeddingProviders}
      ocrLanguages={ocrLanguages}
    />
  );
}