// The documents page while it is rendered: the same containers, rows and table columns as DocumentsDisplay, so that
// nothing moves when it arrives. Only the title, which never changes, is written out.

import { cn } from "@/lib/utils";

const ROWS = 8;
// The widths of the status buttons: Tous, Indexé, En attente, En cours, Erreur, Annulé, À réindexer, Jamais indexé.
const STATUS_WIDTHS = ["w-14", "w-[4.5rem]", "w-24", "w-[5.5rem]", "w-16", "w-[4.5rem]", "w-24", "w-28"];

function Bar({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export default function DocumentsLoading() {
  return (
    <div role="status" className="p-6 max-w-7xl mx-auto">
      <span className="sr-only">Chargement des documents…</span>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestion et suivi de vos documents indexés.</p>
        </div>
        <div className="flex gap-2">
          <Bar className="h-7 w-20" />
          <Bar className="h-7 w-32" />
        </div>
      </div>

      {/* The status buttons: a row that scrolls sideways on a phone. */}
      <div className="-mx-6 mb-4 flex gap-2 overflow-x-hidden px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {STATUS_WIDTHS.map((width, index) => (
          <Bar key={index} className={cn("h-7 shrink-0", width)} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Bar className="h-7 w-full sm:max-w-xs" />
        <Bar className="ml-auto h-7 w-24" />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/20">
            <tr className="h-[41px] border-b [&>th]:px-2 md:[&>th]:px-4">
              <th><Bar className="mx-auto h-4 w-16" /></th>
              <th className="w-[13%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-14" /></th>
              <th className="w-[8%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-10" /></th>
              <th className="w-[9%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-12" /></th>
              <th className="md:w-24 hidden md:table-cell"><Bar className="mx-auto h-4 w-14" /></th>
              <th className="w-28 md:w-32 lg:w-[11%]"><Bar className="mx-auto h-4 w-12" /></th>
              <th className="w-[12%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-16" /></th>
              <th className="md:w-28 lg:w-[12%] hidden md:table-cell"><Bar className="mx-auto h-4 w-16" /></th>
              <th className="w-10 md:w-12" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, index) => (
              <tr key={index} className="h-[45px] border-t [&>td]:px-2 md:[&>td]:px-4">
                <td>
                  <div className="flex items-center gap-2">
                    <Bar className="size-4 shrink-0" />
                    <Bar className="h-4 w-full max-w-36" />
                  </div>
                </td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-5 w-20 rounded-full" /></td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-4 w-8" /></td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-4 w-12" /></td>
                <td className="hidden md:table-cell"><Bar className="mx-auto h-4 w-6" /></td>
                <td><Bar className="mx-auto h-5 w-16 rounded-full" /></td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-4 w-20" /></td>
                <td className="hidden md:table-cell"><Bar className="mx-auto h-4 w-20" /></td>
                <td><Bar className="mx-auto size-5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
