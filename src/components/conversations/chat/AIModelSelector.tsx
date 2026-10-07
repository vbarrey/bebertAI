"use client";

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
import { Provider } from "@/types/augmented-prisma";

type Props = {
  providerId: string;
  modelName: string;
  providers: Provider[];
  disabled: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelName: string) => void;
};

export function AIModelSelector({
  providerId,
  modelName,
  providers,
  disabled = false,
  onProviderChange,
  onModelChange,
}: Props) {
  const provider = providers.find(
    (provider) => provider.id === providerId,
  );

  return (
    <div className="group">
      <div className="flex items-center rounded-xl border bg-background shadow-sm transition-all duration-200">
        {/* État rétracté */}
        <div className="flex h-10 items-center px-3 text-sm font-medium whitespace-nowrap group-hover:hidden">
          {modelName || "Modèle"}
        </div>

        {/* Formulaire */}
        <div className="hidden items-center gap-2 p-2 group-hover:flex">
          <Field>
            <FieldContent>
              <FieldLabel>Provider</FieldLabel>
            </FieldContent>
            <Select value={providerId} onValueChange={onProviderChange} disabled={disabled}>
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
            <Select value={modelName} onValueChange={onModelChange} disabled={disabled || !providerId}>
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
      </div>
    </div>
  );
}