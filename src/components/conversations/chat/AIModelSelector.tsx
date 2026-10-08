"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Provider } from "@/types/augmented-prisma";

type Props = {
  providerId: string;
  modelName: string;
  providers: Provider[];
  disabled: boolean;
  // Greyed out and never expands: the conversation model can no longer change.
  locked: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelName: string) => void;
};

const transition = { duration: 0.2, ease: "easeOut" } as const;

export function AIModelSelector({
  providerId,
  modelName,
  providers,
  disabled = false,
  locked,
  onProviderChange,
  onModelChange,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  // The select menus are portaled outside the selector: keep it expanded while one is open.
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function handleSelectOpenChange(open: boolean) {
    setIsSelectOpen(open);

    // The menu closes under the cursor without a mouseleave: re-read the hover state on the next pointer move.
    if (!open) {
      document.addEventListener(
        "pointermove",
        (event) => setIsHovered(rootRef.current?.contains(event.target as Node) ?? false),
        { once: true },
      );
    }
  }

  const isExpanded = !locked && (isHovered || isSelectOpen);

  const provider = providers.find(
    (provider) => provider.id === providerId,
  );

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "flex items-center overflow-hidden rounded-xl border shadow-sm",
          locked ? "bg-muted text-muted-foreground" : "bg-background",
        )}
        title={locked ? "Le modèle ne peut plus être changé une fois la conversation commencée." : undefined}
      >
        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              key="form"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={transition}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 p-2">
                <Field>
                  <FieldContent>
                    <FieldLabel>Provider</FieldLabel>
                  </FieldContent>
                  <Select value={providerId} onValueChange={onProviderChange} onOpenChange={handleSelectOpenChange} disabled={disabled}>
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue placeholder="Fournisseur"/>
                    </SelectTrigger>

                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldContent>
                    <FieldLabel>Model</FieldLabel>
                  </FieldContent>
                  <Select value={modelName} onValueChange={onModelChange} onOpenChange={handleSelectOpenChange} disabled={disabled || !providerId}>
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue placeholder="Modèle" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{provider?.name}</SelectLabel>

                        {provider?.models?.map((model) => (
                          <SelectItem key={model.id} value={model.name}>
                            {model.displayName ? model.displayName : model.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="label"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={transition}
              className="overflow-hidden"
            >
              <div className="flex h-10 items-center px-3 text-sm font-medium whitespace-nowrap">
                {modelName || "Modèle"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
