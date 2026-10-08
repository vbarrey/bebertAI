import { type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PipelineItem = {
  id: string;
  title: string;
  description: string;
  content?: ReactNode;
  icon: LucideIcon;
  position: {
    x: number;
    y: number;
  };
};
