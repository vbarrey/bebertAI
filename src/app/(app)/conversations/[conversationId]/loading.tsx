// A conversation while it is rendered: the same page container, centered column of messages and input as the
// conversation page and Chat, so that nothing moves when it arrives.

import { cn } from "@/lib/utils";

function Bar({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

// A question, in the tint of the user bubbles.
function Question({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "h-[38px] max-w-[80%] animate-pulse self-end rounded-2xl bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)] dark:bg-[oklch(from_var(--primary)_0.3_calc(c*0.4)_h)]",
        className,
      )}
    />
  );
}

// An answer: its text, its sources and its actions.
function Answer({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {lines.map((width, index) => <Bar key={index} className={cn("h-4", width)} />)}
      <div className="mt-3 flex gap-2">
        {["w-36", "w-32", "w-36"].map((width, index) => <Bar key={index} className={cn("h-5 rounded-full", width)} />)}
      </div>
      <div className="mt-1 flex gap-3">
        <Bar className="size-4" />
        <Bar className="size-4" />
      </div>
    </div>
  );
}

export default function ConversationLoading() {
  return (
    <div role="status" className="mx-auto flex h-full w-full container flex-col p-6 lg:p-10">
      <span className="sr-only">Chargement de la conversation…</span>

      <Bar className="mb-5 h-8 w-full max-w-xl" />

      <div className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-hidden">
        <div className="flex w-full flex-col gap-12 px-4 pt-12">
          <Question className="w-96" />
          <Answer lines={["w-full", "w-11/12", "w-2/3"]} />
          <Question className="w-64" />
          <Answer lines={["w-full", "w-3/4"]} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pt-2 pb-4">
        <div className="h-[58px] rounded-3xl border bg-background shadow-md dark:bg-input/30" />
        {/* As high as the model selector. */}
        <div className="flex h-8 items-center justify-between gap-2 px-2">
          <Bar className="h-4 w-40" />
          <Bar className="hidden h-3 w-56 sm:block" />
        </div>
      </div>
    </div>
  );
}
