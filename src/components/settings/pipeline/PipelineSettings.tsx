"use client";

import { useState } from "react";
import {
  Brackets,
  FileDown,
  MessageCircleCheck,
  Pickaxe,
  Radar,
  Scissors,
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

import type { PipelineConfig } from "@/lib/pipeline/config";
import type { PipelineParameters } from "@/lib/pipeline/parameters";

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
};

export function PipelineSettings({ initialConfig, providers }: Props) {
  const [parameters, setParameters] = useState(initialConfig.parameters);

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const someExpanded = expandedCardId !== null;

  async function updateStep<K extends keyof PipelineParameters>(
    step: K,
    values: PipelineParameters[K],
  ) {
    const nextParameters = {
      ...parameters,
      [step]: values,
    } as PipelineParameters;

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
              onSave={(values) => updateStep("extraction", values)}
            />
          </section>

          <PipelineCapabilities
            capabilities={[
              {
                label: "Extracteurs disponibles",
                values: initialConfig.capabilities.extraction.extractors,
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
        <div>
          <EmbeddingPipelineForm
            initialValues={parameters.embedding}
            providers={providers}
            onSave={(values) => updateStep("embedding", values)}
          />
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

      <div className="relative h-[80vh] w-full">
        <PipelineEdges someExpanded={someExpanded} />

        <div
          className={cn(
            someExpanded ? "z-15 size-full cursor-pointer" : "hidden",
          )}
          onClick={() => setExpandedCardId(null)}
        />

        <PipelineCardList
          items={items}
          expandedCardId={expandedCardId}
          setExpandedCardId={setExpandedCardId}
        />
      </div>
    </div>
  );
}
