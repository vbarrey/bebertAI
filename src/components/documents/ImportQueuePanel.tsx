"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronUp, CircleDashed, MinusCircle, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TruncatedText } from "@/components/ui/truncated-text";
import { cn } from "@/lib/utils";
import type { ConflictRule } from "@/lib/documents/import-queue";

import { IndexingProgress } from "./DocumentStatusBadge";
import { isFinished, isPending, type ImportItem, type ImportQueue } from "./useImportQueue";

function stepLabel(item: ImportItem): string {
  switch (item.step) {
    case "queued":
      return "En attente";
    case "hashing":
      return "Calcul de l'empreinte";
    case "checking":
      return "Vérification";
    case "conflict":
      return "Déjà présent";
    case "uploading":
      return item.source.kind === "local" ? `Envoi ${Math.round((item.progress ?? 0) * 100)} %` : "Import";
    default:
      return item.message ?? "";
  }
}

function StepIcon({ item }: { item: ImportItem }) {
  switch (item.step) {
    case "queued":
      return <CircleDashed className="size-4 text-muted-foreground" />;
    case "conflict":
      return <TriangleAlert className="size-4 text-amber-500" />;
    case "done":
      return <Check className="size-4 text-emerald-600" />;
    case "skipped":
      return <MinusCircle className="size-4 text-muted-foreground" />;
    case "error":
      return <AlertCircle className="size-4 text-destructive" />;
    default:
      return <Spinner className="size-4 text-muted-foreground" />;
  }
}

function QueueRow({ item, queue }: { item: ImportItem; queue: ImportQueue }) {
  return (
    <li className="space-y-1 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <StepIcon item={item} />
        <TruncatedText className="flex-1 text-sm">{item.name}</TruncatedText>
      </div>

      {item.relativePath && (
        <TruncatedText className="pl-6 text-xs text-muted-foreground">{item.relativePath}</TruncatedText>
      )}

      {item.step === "indexing" ? (
        <IndexingProgress progress={item.indexing} className="space-y-1 pl-6 text-xs" />
      ) : (
        <p className={cn("pl-6 text-xs", item.step === "error" ? "text-destructive" : "text-muted-foreground")}>
          {stepLabel(item)}
        </p>
      )}

      {item.step === "uploading" && item.source.kind === "local" && (
        <Progress value={(item.progress ?? 0) * 100} aria-label="Progression de l'envoi" className="ml-6 w-auto" />
      )}

      {item.step === "conflict" && (
        <div className="space-y-2 pl-6">
          {item.conflict && item.conflict.displayName !== item.name && (
            <p className="text-xs text-muted-foreground">Même contenu que « {item.conflict.displayName} ».</p>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => queue.decide(item.id, "REPLACE")}>
              Remplacer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => queue.decide(item.id, "IGNORE")}>
              Ignorer
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * The files of the import and where each one is. Beside the import dialog, or floating on the page once it is closed.
 */
export function ImportQueuePanel({ queue, floating = false }: { queue: ImportQueue; floating?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const { items } = queue;
  const finished = items.filter(isFinished).length;
  const conflicts = items.filter((item) => item.step === "conflict").length;

  return (
    <section
      aria-label="Fichiers en cours d'import"
      className={cn(
        "flex min-w-0 flex-col gap-3",
        floating && "fixed right-4 bottom-4 z-40 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-4 shadow-lg ring-1 ring-foreground/10",
      )}
    >
      {/* In the dialog, clear of its close button. */}
      <div className={cn("flex items-center gap-2", !floating && "pr-8")}>
        <p className="flex-1 text-sm font-medium">
          Import · {finished}/{items.length} terminé{finished !== 1 ? "s" : ""}
        </p>

        {finished > 0 && (
          <Button size="sm" variant="ghost" onClick={queue.clearFinished}>
            Effacer les terminés
          </Button>
        )}

        {floating && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={collapsed ? "Déplier" : "Replier"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </Button>
        )}
      </div>

      {!collapsed && (
        <>
          {conflicts > 1 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2 text-xs">
              <span className="flex-1">{conflicts} fichiers déjà présents</span>
              <Button size="sm" variant="outline" onClick={() => queue.decideAll("REPLACE")}>
                Tout remplacer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => queue.decideAll("IGNORE")}>
                Tout ignorer
              </Button>
            </div>
          )}

          <ul className={cn("min-w-0 space-y-1 overflow-y-auto", floating ? "max-h-[50vh]" : "max-h-[60vh]")}>
            {items.map((item) => (
              <QueueRow key={item.id} item={item} queue={queue} />
            ))}
          </ul>

          {items.some(isPending) && (
            <p className="text-xs text-muted-foreground">Gardez cette page ouverte jusqu&apos;à la fin des envois.</p>
          )}
        </>
      )}
    </section>
  );
}

/** "Indexer maintenant" and what to do with a file already there, for the files added from now on. */
export function ImportOptions({ queue, id }: { queue: ImportQueue; id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-index-immediately`}
          checked={queue.indexImmediately}
          onCheckedChange={(checked) => queue.setIndexImmediately(checked === true)}
        />
        <label htmlFor={`${id}-index-immediately`} className="cursor-pointer text-sm">
          Indexer maintenant
        </label>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span id={`${id}-rule`}>Si déjà présent :</span>
        <Select value={queue.rule} onValueChange={(value) => queue.setRule(value as ConflictRule)}>
          <SelectTrigger size="sm" aria-labelledby={`${id}-rule`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ASK">Demander</SelectItem>
            <SelectItem value="IGNORE">Ignorer</SelectItem>
            <SelectItem value="REPLACE">Remplacer</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
