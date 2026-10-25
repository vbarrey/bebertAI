"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  // From a Server Component, the message is a generic one in production: the digest finds the error in the server logs.
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/** A page of the app that failed to render, the sidebar staying. Error boundaries are Client Components. */
export default function PageError({ error, unstable_retry }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <TriangleAlert className="size-8 text-muted-foreground" />
        <p className="font-medium">Une erreur est survenue</p>
        <p className="text-sm text-muted-foreground">
          La page n&apos;a pas pu s&apos;afficher. Réessayez ; si l&apos;erreur persiste, le détail est dans les journaux du serveur.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>}
        {/* Renders the page again from the server, not only in the browser. */}
        <Button className="mt-2" onClick={() => unstable_retry()}>Réessayer</Button>
      </div>
    </div>
  );
}
