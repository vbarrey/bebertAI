"use client";

import { useState } from "react";
import {
  Brackets,
  FileDown,
  MessageCircleCheck,
  Pickaxe,
  Radar,
  Scissors,
  TriangleAlert,
} from "lucide-react";

import { PipelineCardList } from "./PipelineCardList";
import { PipelineEdges } from "./PipelineEdges";
import { PipelineCapabilities } from "./PipelineCapabilities";

import { ImportPipelineForm } from "./forms/ImportPipelineForm";
import { ExtractionPipelineForm } from "./forms/ExtractionPipelineForm";
import { ChunkingPipelineForm } from "./forms/ChunkingPipelineForm";
import { EmbeddingPipelineForm } from "./forms/EmbeddingPipelineForm";
import { RetrievalPipelineForm } from "./forms/RetrievalPipelineForm";
import { GenerationPipelineForm } from "./forms/GenerationPipelineForm";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { PipelineConfig } from "@/lib/pipeline/config";
import { requiresReindex, type PipelineParameters } from "@/lib/pipeline/parameters";

import type { PipelineItem } from "./types";
import { cn } from "@/lib/utils";

type Provider = {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
    displayName: string | null;
  }[];
};

type Props = {
  initialConfig: PipelineConfig;
  providers: readonly Provider[];
  ocrLanguages: readonly string[];
};

export function PipelineSettings({ initialConfig, providers, ocrLanguages }: Props) {
  const [parameters, setParameters] = useState(initialConfig.parameters);

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Resolves the pending save with the answer of the reindex confirmation dialog.
  const [confirmReindex, setConfirmReindex] = useState<((confirmed: boolean) => void) | null>(null);

  const someExpanded = expandedCardId !== null;

  async function updateStep<K extends keyof PipelineParameters>(
    step: K,
    values: PipelineParameters[K],
  ) {
    const nextParameters = {
      ...parameters,
      [step]: values,
    } as PipelineParameters;

    if (requiresReindex(parameters, nextParameters)) {
      const confirmed = await new Promise<boolean>((resolve) => setConfirmReindex(() => resolve));
      setConfirmReindex(null);

      if (!confirmed) {
        throw new Error("Enregistrement annulé.");
      }
    }

    const response = await fetch("/api/pipeline", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextParameters),
    });

    const payload = (await response.json()) as
      | PipelineConfig
      | { error: string };

    if (!response.ok) {
      throw new Error(
        "error" in payload
          ? payload.error
          : "Impossible d'enregistrer les paramètres du pipeline.",
      );
    }

    if ("parameters" in payload) setParameters(payload.parameters);
  }

  // Shown under the forms of the steps listed in REINDEX_STEPS.
  const reindexNotice = (
    <p className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Modifier les paramètres de cette étape nécessite de réindexer tous les documents.
    </p>
  );

  const items: PipelineItem[] = [
    {
      id: "01-Importation",
      title: "Importation",
      description:
        "Gère l'importation des documents dans l'application et les types pris en charge.",
      icon: FileDown,
      position: {
        x: 18,
        y: 16.66,
      },
      content: (
        <div className="space-y-6">
          <section>
            <ImportPipelineForm
              initialValues={parameters.import}
              onSave={(values) => updateStep("import", values)}
            />
          </section>

          <PipelineCapabilities
            capabilities={[
              {
                label: "Formats pris en charge",
                values: initialConfig.capabilities.import.supportedFormat,
              },
            ]}
          />
        </div>
      ),
    },

    {
      id: "02-Extraction",
      title: "Extraction",
      description: "Extrait le texte des documents.",
      icon: Pickaxe,
      position: {
        x: 50,
        y: 16.66,
      },
      content: (
        <div className="space-y-6">
          <section>
            <ExtractionPipelineForm
              initialValues={parameters.extraction}
              ocrLanguages={ocrLanguages}
              onSave={(values) => updateStep("extraction", values)}
            />
          </section>

          {reindexNotice}

          <PipelineCapabilities
            capabilities={[
              {
                label: "Extracteurs disponibles",
                values: initialConfig.capabilities.extraction.extractors,
              },
              {
                label: "Langues OCR installées",
                values: ocrLanguages,
              },
            ]}
          />
        </div>
      ),
    },

    {
      id: "03-Découpage",
      title: "Découpage",
      description:
        "Découpe le contenu extrait des documents en morceaux contextuels et adaptés au modèle de vectorisation (embedding).",
      icon: Scissors,
      position: {
        x: 82,
        y: 16.66,
      },
      content: (
        <div className="space-y-6">
          <section>
            <ChunkingPipelineForm
              initialValues={parameters.chunking}
              onSave={(values) => updateStep("chunking", values)}
            />
          </section>

          {reindexNotice}

          <PipelineCapabilities
            capabilities={[
              {
                label: "Stratégies implémentées",
                values: initialConfig.capabilities.chunking.strategies,
              },
            ]}
          />
        </div>
      ),
    },

    {
      id: "04-Vectorisation",
      title: "Vectorisation",
      description:
        "Vectorise les morceaux de documents et les questions utilisateur avec le même modèle pour pouvoir les comparer.",
      icon: Brackets,
      position: {
        x: 50,
        y: 50,
      },
      content: (
        <div className="space-y-6">
          <EmbeddingPipelineForm
            initialValues={parameters.embedding}
            providers={providers}
            onSave={(values) => updateStep("embedding", values)}
          />

          {reindexNotice}
        </div>
      ),
    },

    {
      id: "05-Récupération",
      title: "Récupération",
      description:
        "Retrouve, filtre et réordonne les vecteurs liés à celui généré pour la question utilisateur.",
      icon: Radar,
      position: {
        x: 18,
        y: 83.33,
      },
      content: (
        <div>
          <RetrievalPipelineForm
            initialValues={parameters.retrieval}
            providers={providers}
            onSave={(values) => updateStep("retrieval", values)}
          />
        </div>
      ),
    },

    {
      id: "06-Génération",
      title: "Génération",
      description:
        "Génère une réponse adaptée à l'utilisateur en utilisant si nécessaire les sources obtenues.",
      icon: MessageCircleCheck,
      position: {
        x: 82,
        y: 83.33,
      },
      content: (
        <div>
          <GenerationPipelineForm
            initialValues={parameters.generation}
            providers={providers}
            onSave={(values) => updateStep("generation", values)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="container flex w-full flex-col p-4">
      <h2 className="mb-4 text-xl">Pipeline</h2>

      <div className="flex w-full flex-col gap-3 md:relative md:block md:h-[80vh]">
        <PipelineEdges someExpanded={someExpanded} />

        <div
          className={cn(
            someExpanded ? "z-15 hidden size-full cursor-pointer md:block" : "hidden",
          )}
          onClick={() => setExpandedCardId(null)}
        />

        <PipelineCardList
          items={items}
          expandedCardId={expandedCardId}
          setExpandedCardId={setExpandedCardId}
        />
      </div>

      <AlertDialog
        open={confirmReindex !== null}
        onOpenChange={(open) => !open && confirmReindex?.(false)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              <TriangleAlert />
            </AlertDialogMedia>

            <AlertDialogTitle>
              Réindexation nécessaire
            </AlertDialogTitle>

            <AlertDialogDescription>
              Les documents indexés passeront « À réindexer » et ne seront plus utilisés
              par le chat avant leur réindexation.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Annuler
            </AlertDialogCancel>

            {/* Its onClick runs before the dialog closes, so the save resolves as confirmed. */}
            <AlertDialogAction onClick={() => confirmReindex?.(true)}>
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
