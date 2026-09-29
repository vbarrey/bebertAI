import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreVertical } from "lucide-react";

export function DocumentActions() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreVertical className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4}>
        <div className="flex flex-col space-y-1 p-1">
          <Button variant="ghost" size="sm" className="w-full justify-start">Indexer</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">Réindexer</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">Visualiser</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">Détails</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
