import { PipelineItem } from "./types";
import { PipelineCardItem } from "./PipelineCardItem";

export function PipelineCardList({ items, expandedCardId, setExpandedCardId }: { items: PipelineItem[], expandedCardId: string | null, setExpandedCardId: (id:string|null)=>void }) {
  return (
    <>
      {items.map((item) => (
        <PipelineCardItem
          key={item.id}
          item={item}
          isExpanded={expandedCardId === item.id}
          someExpanded={expandedCardId !== null}
          onExpand={() => setExpandedCardId(item.id)}
          onClose={() => setExpandedCardId(null)}
        />
      ))}
    </>
  );
}
