"use client";

import { ChevronDown, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderAvatar } from "@/components/settings/providers/provider-avatar";
import { Provider } from "@/types/augmented-prisma";

type Props = {
  providerId: string;
  modelName: string;
  providers: Provider[];
  disabled: boolean;
  // The conversation has started: its model can no longer change.
  locked: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelName: string) => void;
};

/** The model of the conversation; a click opens the provider and model choice until the first message. */
export function AIModelSelector({
  providerId,
  modelName,
  providers,
  disabled = false,
  locked,
  onProviderChange,
  onModelChange,
}: Props) {
  const provider = providers.find((provider) => provider.id === providerId);
  const model = provider?.models?.find((model) => model.name === modelName);
  const label = model?.displayName || modelName || "Modèle";

  const summary = (
    <>
      <ProviderAvatar providerId={providerId} size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
      {provider && <span className="hidden truncate text-muted-foreground sm:inline">· {provider.name}</span>}
    </>
  );

  if (locked) {
    return (
      <div
        className="flex h-8 min-w-0 items-center gap-2 rounded-full px-2 text-xs text-muted-foreground"
        title="Le modèle ne peut plus être changé une fois la conversation commencée."
      >
        {summary}
        <Lock className="size-3 shrink-0" aria-label="Modèle verrouillé" />
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 min-w-0 gap-2 rounded-full px-2 text-xs" disabled={disabled}>
          {summary}
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 gap-3 p-3">
        <Field>
          <FieldLabel>Fournisseur</FieldLabel>
          <Select value={providerId} onValueChange={onProviderChange} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Fournisseur">{provider?.name}</SelectValue>
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
          <FieldLabel>Modèle</FieldLabel>
          <Select value={modelName} onValueChange={onModelChange} disabled={disabled || !providerId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Modèle">{label}</SelectValue>
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
      </PopoverContent>
    </Popover>
  );
}
