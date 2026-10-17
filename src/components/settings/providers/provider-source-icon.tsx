"use client";

import { Cloud } from "lucide-react";
import type { AIProviderSource } from "@prisma/client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ProviderSourceIconProps = {
  source: AIProviderSource;
  // False inside another interactive element (a provider card), which keeps the focus.
  focusable?: boolean;
  className?: string;
};

// Nothing for a local provider: only a remote one costs and receives the data.
export function ProviderSourceIcon({ source, focusable = true, className }: ProviderSourceIconProps) {
  if (source !== "REMOTE") {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={focusable ? 0 : undefined}
          aria-label="Fournisseur distant"
          className={cn("inline-flex shrink-0 rounded-sm text-muted-foreground", className)}
        >
          <Cloud className="size-4" />
        </span>
      </TooltipTrigger>

      <TooltipContent>
        Fournisseur distant : son utilisation peut engendrer des coûts, et une copie des données envoyées (messages et
        documents) est transmise au fournisseur.
      </TooltipContent>
    </Tooltip>
  );
}
