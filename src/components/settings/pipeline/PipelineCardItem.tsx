import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

import { PipelineItem } from "./types";

import { SubPipelineCardItem } from "./SubPipelineCardItem";

export function PipelineCardItem({
  item,
  isExpanded,
  someExpanded,
  onExpand,
  onClose,
}: {
  item: PipelineItem;
  someExpanded: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <Card
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top,width,filter,box-shadow]",
        item.subCards ? "w-[40%]" : "w-[20%]",
        !isExpanded && someExpanded
          ? "blur-xs cursor-default"
          : "cursor-pointer hover:border-primary hover:shadow-lg",
        isExpanded ? "z-20 w-[80%] min-h-[30vh] cursor-default" : "z-10",
      )}
      style={{
        left: isExpanded ? "50%" : `${item.position.x}%`,
        top: isExpanded ? "50%" : `${item.position.y}%`,
      }}
      onClick={!isExpanded ? onExpand : undefined}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 shrink-0 text-muted-foreground" />

          <span className="flex-1">{item.title}</span>

          {isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              aria-label="Fermer"
            >
              <XCircle className="size-4" />
            </Button>
          )}
        </CardTitle>

        <CardDescription className="text-xs">
          {item.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {item.subCards && (
          <div className="flex flex-col gap-2">
            {item.subCards.map((subItem) => (
              <SubPipelineCardItem key={subItem.id} subItem={subItem} />
            ))}
          </div>
        )}

        {isExpanded && item.content}
      </CardContent>
    </Card>
  );
}
