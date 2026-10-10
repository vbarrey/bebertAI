import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { INDEXING_STAGE_LABELS, indexingProgressPercent, type IndexingSteps } from "@/lib/queue/types";
import { AlertCircle, CheckCircle2, History, Info, RefreshCw } from "lucide-react";
import { IndexingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const statusMap: Record<IndexingStatus, { label: string; icon: typeof AlertCircle; variant: "ghost" | "outline" | "secondary" | "default" | "destructive"; customClassName?: string }> = {
  PENDING: { label: "En attente", icon: Info, variant: "ghost" },
  UNPLANNED: { label: "Jamais indexé", icon: Info, variant: "outline" },
  PROCESSING: { label: "En cours", icon: RefreshCw, variant: "secondary" },
  PROCESSED: { label: "Indexé", icon: CheckCircle2, variant: "default", customClassName: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"},
  FAILED: { label: "Erreur", icon: AlertCircle, variant: "destructive" },
  CANCELLED: { label: "Annulé", icon: AlertCircle, variant: "destructive" },
  NEEDREINDEX: { label: "À réindexer", icon: History, variant: "outline", customClassName: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
};

type Props = {
  status: IndexingStatus;
  error?: string | null;
  // Last progress sent by the worker over SSE, while the document is being indexed.
  progress?: IndexingSteps;
};

export function DocumentStatusBadge({ status, error, progress }: Props) {
  const { label, icon: Icon, variant, customClassName } = statusMap[status];
  const badge = (
    <Badge variant={variant} className={cn("flex items-center gap-1 text-xs font-medium m-auto", customClassName)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );

  if (status === "PENDING" || status === "PROCESSING") {
    return <IndexingProgressCard progress={progress}>{badge}</IndexingProgressCard>;
  }

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

function IndexingProgressCard({ progress, children }: { progress?: IndexingSteps; children: React.ReactNode }) {
  const percent = progress ? indexingProgressPercent(progress) : 0;
  // No progress yet: the job waits in the queue, or started before the page was opened.
  const label = progress ? INDEXING_STAGE_LABELS[progress.stage] ?? progress.stage : "En attente du worker";

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className="m-auto flex cursor-help">{children}</button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{label}</span>
          <span className="tabular-nums text-muted-foreground">{percent} %</span>
        </div>
        <Progress value={percent} aria-label="Progression de l'indexation" />
        {progress?.total ? (
          <p className="text-muted-foreground tabular-nums">
            Page {progress.current ?? 0} / {progress.total}
          </p>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
