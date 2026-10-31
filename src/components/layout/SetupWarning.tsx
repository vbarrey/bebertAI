import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { isSetupComplete, type SetupStatus } from "@/lib/pipeline/setup";

export function SetupWarning({ status }: { status: SetupStatus }) {
  if (isSetupComplete(status)) return null;

  const noProvider = status.providerCount === 0;

  return (
    <div role="alert" className="m-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 space-y-1">
        {noProvider ? (
          <p>Aucun fournisseur d&apos;IA n&apos;est configuré : la discussion et l&apos;indexation des documents ne fonctionneront pas.</p>
        ) : (
          <>
            {status.generation && <p>Discussion indisponible : {status.generation}</p>}
            {status.embedding && <p>Indexation et recherche indisponibles : {status.embedding}</p>}
          </>
        )}
        <Link href={noProvider ? "/settings/provider" : "/settings/pipeline"} className="font-medium underline underline-offset-4">
          {noProvider ? "Ajouter un fournisseur" : "Configurer le pipeline"}
        </Link>
      </div>
    </div>
  );
}
