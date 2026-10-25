import type { Metadata } from "next";

import NotFound from "./(app)/not-found";

export const metadata: Metadata = { title: "Page introuvable" };

/** An address matching no page: rendered in the root layout, without the sidebar. */
export default function RootNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <NotFound />
    </main>
  );
}
