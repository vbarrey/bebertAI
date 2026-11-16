// The documents page while it is rendered: the same containers, grid and table columns as DocumentsDisplay, so that
// nothing moves when it arrives. Only the title, which never changes, is written out.

import { cn } from "@/lib/utils";

const ROWS = 6;

function Bar({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export default function DocumentsLoading() {
  return (
    <div role="status" className="p-6 max-w-7xl mx-auto">
      <span className="sr-only">Chargement des documents…</span>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-1">Gestion et suivi de vos documents indexés.</p>
        </div>
        <Bar className="mt-4 h-7 w-36 lg:mt-0" />
      </div>

      {/* The status cards: a row that scrolls sideways on a phone, a grid from md. */}
      <div className="-mx-6 mb-8 flex gap-2 overflow-x-hidden px-6 pb-1 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:px-0 md:pb-0">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex h-[52px] w-28 shrink-0 items-center gap-2 rounded-xl border px-3 md:w-auto md:px-4">
            <Bar className="h-5 w-6 rounded-full" />
            <Bar className="h-4 w-20" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 mb-6">
        <Bar className="h-7 w-full max-w-xs" />
        <Bar className="h-7 w-16" />
        {/* The real button sits in an animated block, 2px higher when the controls are stacked. */}
        <Bar className="h-[26px] w-28 sm:ml-auto sm:h-6" />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full table-fixed">
          <thead className="bg-muted/20">
            {/* As high as the real header and rows, whose titles and dates wrap on narrower columns. */}
            <tr className="h-[41px] md:h-[65px] [&>th]:px-2 md:[&>th]:px-4">
              <th><Bar className="mx-auto h-4 w-16" /></th>
              <th className="w-[13%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-14" /></th>
              <th className="w-[8%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-10" /></th>
              <th className="w-[9%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-12" /></th>
              <th className="md:w-24 hidden md:table-cell"><Bar className="mx-auto h-4 w-14" /></th>
              <th className="w-24 md:w-32 lg:w-[11%]"><Bar className="mx-auto h-4 w-12" /></th>
              <th className="w-[12%] hidden lg:table-cell"><Bar className="mx-auto h-4 w-20" /></th>
              <th className="md:w-28 lg:w-[12%] hidden md:table-cell"><Bar className="mx-auto h-4 w-20" /></th>
              <th className="w-20 md:w-24"><Bar className="mx-auto h-4 w-14" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, index) => (
              <tr key={index} className="h-[53px] md:h-[97px] lg:h-[73px] border-t [&>td]:px-2 md:[&>td]:px-4">
                <td>
                  <div className="flex items-center gap-2">
                    <Bar className="size-4 shrink-0" />
                    <Bar className="h-4 w-full max-w-36" />
                  </div>
                </td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-5 w-20 rounded-full" /></td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-4 w-8" /></td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-4 w-16" /></td>
                <td className="hidden md:table-cell"><Bar className="mx-auto h-4 w-6" /></td>
                <td><Bar className="mx-auto h-5 w-16 rounded-full" /></td>
                <td className="hidden lg:table-cell"><Bar className="mx-auto h-4 w-20" /></td>
                <td className="hidden md:table-cell"><Bar className="h-4 w-20" /></td>
                <td><Bar className="mx-auto size-5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
