import { cn } from "@/lib/utils";

import { PipelineArrow } from "./PipelineArrow";

export function PipelineEdges({ someExpanded }: { someExpanded: boolean}) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 z-0 size-full",
        someExpanded ? "blur-xs" : "",
      )}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="pipeline-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" />
        </marker>
      </defs>

      {/* Importation → Extraction */}
      <path
        d="M 18 16.66 H 50"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.2"
        strokeLinecap="round"
        markerEnd="url(#pipeline-arrow)"
      />

      {/* Extraction → Découpage */}
      <path
        d="M 50 16.66 H 82"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.2"
        strokeLinecap="round"
        markerEnd="url(#pipeline-arrow)"
      />

      {/* Découpage → Vectorisation */}
      <path
        d="M 82 16.66 V 47 Q 82 50 79 50 H 50"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd="url(#pipeline-arrow)"
      />

      {/* Vectorisation → Récupération */}
      <path
        d="M 50 50 H 21 Q 18 50 18 53 V 83.33"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd="url(#pipeline-arrow)"
      />

      {/* Récupération → Génération */}
      <path
        d="M 18 83.33 H 82"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.2"
        strokeLinecap="round"
        markerEnd="url(#pipeline-arrow)"
      />

      <PipelineArrow x={34} y={16.66} rotation={0} />
      <PipelineArrow x={66} y={16.66} rotation={0} />
      <PipelineArrow x={82} y={33} rotation={90} />
      <PipelineArrow x={18} y={64} rotation={90} />
      <PipelineArrow x={50} y={83.33} rotation={0} />
    </svg>
  );
}