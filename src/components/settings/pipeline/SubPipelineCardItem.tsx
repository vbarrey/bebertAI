import { PipelineItem } from "./types";

export function SubPipelineCardItem({ subItem }: { subItem: PipelineItem }) {
  const Icon = subItem.icon;

  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />

      <div className="min-w-0">
        <p className="text-xs font-medium">{subItem.title}</p>

        <p className="text-xs text-muted-foreground">{subItem.description}</p>
      </div>
    </div>
  );
}