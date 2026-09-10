"use client";

import {
  Brackets,
  FileDown,
  Pickaxe,
  Scissors,
  Radar,
  MessageCircleCheck,
  File,
  MessageCircleQuestionMark,
} from "lucide-react";

import { PipelineItem } from "@/components/settings/pipeline/types";
import { PipelineCardList } from "@/components/settings/pipeline/PipelineCardList";
import { PipelineEdges } from "@/components/settings/pipeline/PipelineEdges";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  },
  {
    id: "04-Vectorisation",
    title: "Vectorisation",
    description: "",
    icon: Brackets,
    position: {
      x: 50,
      y: 50,
    },
    subCards: [
      {
        id: "01-Document",
        title: "Document",
        description:
          "Vectorise les morceaux de documents pour les sauvegarder en base de données.",
        icon: File,
        position: {
          x: 0,
          y: 0,
        },
      },
      {
        id: "02-Requête",
        title: "Requête",
        description:
          "Transforme la question utilisateur en vecteur utilisable par la base de données vectorielle.",
        icon: MessageCircleQuestionMark,
        position: {
          x: 0,
          y: 0,
        },
      },
    ],
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
  },
];

export default function PipelineSettingsPage() {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const someExpanded = expandedCardId !== null;
  return (
    <div className="container flex w-full flex-col p-4">
      <h2 className="mb-4 text-xl">Pipeline</h2>
      <div className="relative h-[80vh] w-full">
        <PipelineEdges someExpanded={someExpanded} />
        <div className={cn(someExpanded ? "size-full z-15 pointer-cursor" : "hidden")} onClick={() => setExpandedCardId(null)}></div>
        <PipelineCardList items={items} expandedCardId={expandedCardId} setExpandedCardId={setExpandedCardId}/>
      </div>
    </div>
  );
}
