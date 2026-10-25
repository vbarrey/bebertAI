import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A page of the app calling notFound(), the sidebar staying: a conversation or a project deleted, or another user's,
 * which is not told apart from a missing one.
 */
export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <FileQuestion className="size-8 text-muted-foreground" />
        <p className="font-medium">Page introuvable</p>
        <p className="text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou plus : la conversation ou le projet a peut-être été supprimé.
        </p>
        <Button asChild className="mt-2">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}
