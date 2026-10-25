"use client";

import "./globals.css";

import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/**
 * The last resort: an error of the root layout, or of the app layout (session, sidebar), which no error.tsx above
 * catches. It replaces the root layout: its own document, the global styles imported again, the light theme.
 */
export default function GlobalError({ error, unstable_retry }: Props) {
  return (
    <html lang="fr">
      <body className="font-sans">
        <title>Erreur · Bebert AI</title>
        <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="font-medium">Bebert AI n&apos;a pas pu s&apos;afficher</p>
          <p className="text-sm text-muted-foreground">Réessayez ; si l&apos;erreur persiste, le détail est dans les journaux du serveur.</p>
          {error.digest && <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>}
          <Button className="mt-2" onClick={() => unstable_retry()}>Réessayer</Button>
        </main>
      </body>
    </html>
  );
}
