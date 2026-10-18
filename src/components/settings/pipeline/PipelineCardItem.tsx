import { useEffect, useRef } from "react";

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
  const cardRef = useRef<HTMLDivElement>(null);

  // Phone list: the opened card can be below the screen. The diagram opens it in the middle.
  useEffect(() => {
    if (isExpanded && window.matchMedia("(max-width: 47.99rem)").matches) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isExpanded]);

  return (
    <Card
      ref={cardRef}
      className={cn(
        // Phone: a list in the page flow, the card opening in place; md: the diagram.
        "transition-[left,top,width,filter,box-shadow] md:absolute md:-translate-x-1/2 md:-translate-y-1/2",
        !isExpanded && someExpanded
          ? "md:blur-xs md:cursor-default"
          : "cursor-pointer hover:border-primary hover:shadow-lg",
        isExpanded ? "z-20 cursor-default md:min-h-[30vh] md:w-[80%]" : "z-10 md:w-[20%]",
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

      {isExpanded && <CardContent>{item.content}</CardContent>}
    </Card>
  );
}
