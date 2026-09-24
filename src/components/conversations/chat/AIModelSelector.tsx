"use client"

import { Provider, Model } from "./ChatInput";

import { Button } from "@/components/ui/button";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Fragment } from "react/jsx-runtime";

type Props = {
  isStreaming: boolean;
  providers: Provider[];
  defaultModel: Model;
  selectedModelId: string;
  onValueChange: (value: string) => void;
};

export function AIModelSelector({
  isStreaming,
  providers,
  defaultModel,
  selectedModelId,
  onValueChange,
}: Props) {

  const allModels = providers.map(p => p.models).flat();
  const [selectedModel, setSelectedModel] = useState<Model>(allModels.find(model => model.id === selectedModelId) ?? defaultModel);

  const handleModelChange = (value: string) => {
    try {
      const {_, modelId} = JSON.parse(value);
      
      if(!modelId) throw new Error("Invalid model ID");
      
      const model = allModels.find(m => m.id == modelId);
      
      if(!model) throw new Error(`The model with ID "${modelId}" does not exist. Please select a valid model.` );
      
      setSelectedModel(model);
    } catch (error) {
      console.error(error);
    }
    onValueChange(value);
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" disabled={isStreaming} className="rounded-full p-4">
            {selectedModel.name}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top">
          <Select
            defaultValue={selectedModel.value}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="w-full max-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider, index) => (
                <Fragment key={provider.id}>
                  <SelectGroup>
                    <SelectLabel>{provider.name}</SelectLabel>

                    {provider.models.map((model) => (
                      <SelectItem key={model.id} value={model.value}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  {index < providers.length - 1 && <SelectSeparator />}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    </>
  );
}
