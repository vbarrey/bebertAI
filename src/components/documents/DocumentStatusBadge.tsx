import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { IndexingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const statusMap: Record<IndexingStatus, { label: string; icon: typeof AlertCircle; variant: "ghost" | "outline" | "secondary" | "default" | "destructive"; customClassName?: string }> = {
  PENDING: { label: "En attente", icon: Info, variant: "ghost" },
  UNPLANNED: { label: "Jamais indexé", icon: Info, variant: "outline" },
  PROCESSING: { label: "En cours", icon: RefreshCw, variant: "secondary" },
  PROCESSED: { label: "Indexé", icon: CheckCircle2, variant: "default", customClassName: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"},
  FAILED: { label: "Erreur", icon: AlertCircle, variant: "destructive" },
  CANCELLED: { label: "Annulé", icon: AlertCircle, variant: "destructive" },
};

export function DocumentStatusBadge({ status, error }: { status: IndexingStatus; error?: string | null }) {
  const { label, icon: Icon, variant, customClassName } = statusMap[status];
  const badge = (
    <Badge variant={variant} className={cn("flex items-center gap-1 text-xs font-medium m-auto", customClassName)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );

  if (status !== "FAILED" || !error) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="m-auto flex cursor-help">{badge}</button>
      </TooltipTrigger>
      <TooltipContent className="max-w-md break-words">{error}</TooltipContent>
    </Tooltip>
  );
}
