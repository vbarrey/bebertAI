"use client";

import Image from "next/image";

import { AIProviderType } from "@prisma/client";

import { ProviderSourceIcon } from "./provider-source-icon";

type Props = {
  onSelect: (type: AIProviderType) => void;
};

// The types a provider can be created with (OpenAI has no client yet).
export const providerTypes = [
  { type: "OLLAMA_LOCAL", name: "Ollama (local)", description: "Modèles exécutés sur cette machine.", icon: "/icons/ollama.svg", source: "LOCAL" },
  { type: "OLLAMA_CLOUD", name: "Ollama Cloud", description: "Modèles Ollama hébergés sur ollama.com.", icon: "/icons/ollama.svg", source: "REMOTE" },
  { type: "ANTHROPIC", name: "Anthropic", description: "Modèles Claude, pour la génération.", icon: "/icons/anthropic.svg", source: "REMOTE" },
  { type: "VOYAGE", name: "Voyage AI", description: "Modèles d'embedding.", icon: "/icons/voyage.svg", source: "REMOTE" },
] as const;

export function ProviderTypeSelector({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 py-4">
      {providerTypes.map((provider) => (
        <button
          key={provider.type}
          type="button"
          onClick={() => onSelect(provider.type)}
          className="flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex w-full items-center justify-between">
            {/* Black logos: inverted on the dark theme. */}
            <Image src={provider.icon} alt="" width={28} height={28} className="dark:invert" />

            <ProviderSourceIcon source={provider.source} focusable={false} />
          </div>

          <div>
            <p className="text-sm font-medium">{provider.name}</p>

            <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
