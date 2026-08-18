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
import { Fragment } from "react/jsx-runtime";

type Props = {
  isStreaming: boolean;
  providers: Provider[];
  defaultModel: Model;
  onValueChange: (value: string) => void;
};

export function AIModelSelector({
  isStreaming,
  providers,
  defaultModel,
  onValueChange,
}: Props) {

  const modelValues = providers.map(p => p.models).flat().map(m => m.value);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" disabled={isStreaming} className="rounded-full p-4">
            {defaultModel.name}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top">
          <Select
            items={modelValues}
            defaultValue={defaultModel.value}
            onValueChange={onValueChange}
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
