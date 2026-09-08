export function PipelineArrow({
  x,
  y,
  rotation = 0,
}: {
  x: number;
  y: number;
  rotation?: number;
}) {
  return (
    <path
      d="M -0.5 -0.5 L 0 0 L -0.5 0.5"
      fill="none"
      className="stroke-muted-foreground"
      strokeWidth="0.2"
      stroke="var(--border)"
      transform={`translate(${x} ${y}) rotate(${rotation})`}
    />
  );
}
