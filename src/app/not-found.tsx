import NotFound from "./(app)/not-found";

/** An address matching no page: rendered in the root layout, without the sidebar. */
export default function RootNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <NotFound />
    </main>
  );
}
