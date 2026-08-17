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
  aiIdItems: any[];
  value?: string;
  onValueChange: (value: string) => void;
};

export function AIModelSelector({
  isStreaming,
  aiIdItems,
  value,
  onValueChange,
}: Props) {
  
  const allItems = aiIdItems.map((pItem: any) => pItem.models).flat();

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" disabled={isStreaming}>
            Model
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top">
          <Select
            items={allItems}
            defaultValue={value}
            onValueChange={onValueChange}
          >
            <SelectTrigger className="w-full max-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aiIdItems.map((provider, index) => (
                <Fragment key={provider.id}>
                  <SelectGroup>
                    <SelectLabel>{provider.name}</SelectLabel>

                    {provider.models.map((model) => (
                      <SelectItem key={model.id} value={model.value}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  {index < aiIdItems.length - 1 && <SelectSeparator />}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    </>
  );
}
