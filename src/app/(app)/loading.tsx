/**
 * Shown at once while a page of the app is rendered, inside the sidebar layout: Next.js wraps each page below in a
 * Suspense boundary with it, streams the page in when ready, and prefetches it with the links to these pages.
 */
export default function Loading() {
  return (
    <div role="status" className="mx-auto w-full max-w-7xl space-y-4 p-6">
      <span className="sr-only">Chargement…</span>
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
