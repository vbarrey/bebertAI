import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { IndexingStatus } from "@prisma/client";

const statusMap: Record<IndexingStatus, { label: string; icon: typeof AlertCircle; variant: "ghost" | "outline" | "secondary" | "default" | "destructive" }> = {
  PENDING: { label: "En attente", icon: Info, variant: "ghost" },
  UNPLANNED: { label: "Jamais indexé", icon: Info, variant: "outline" },
  PROCESSING: { label: "En cours", icon: RefreshCw, variant: "secondary" },
  PROCESSED: { label: "Indexé", icon: CheckCircle2, variant: "default" },
  FAILED: { label: "Erreur", icon: AlertCircle, variant: "destructive" },
  CANCELLED: { label: "Annulé", icon: AlertCircle, variant: "destructive" },
};

export function DocumentStatusBadge({ status }: { status: IndexingStatus }) {
  const { label, icon: Icon, variant } = statusMap[status];
  return (
    <Badge variant={variant} className="flex items-center gap-1 text-xs font-medium m-auto">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
