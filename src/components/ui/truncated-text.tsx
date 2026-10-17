"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type TruncatedTextProps = {
  children: string;
  className?: string;
};

/**
 * One line cut with an ellipsis, the full text in a tooltip when it is cut. Measured when the tooltip would
 * open: the width the text gets changes with the layout.
 */
export function TruncatedText({ children, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    const element = ref.current;
    setOpen(next && !!element && element.scrollWidth > element.clientWidth);
  }

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn("block min-w-0 truncate", className)}>
          {children}
        </span>
      </TooltipTrigger>

      <TooltipContent className="break-all">{children}</TooltipContent>
    </Tooltip>
  );
}
