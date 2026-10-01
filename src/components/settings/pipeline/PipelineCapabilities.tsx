import { Badge } from "@/components/ui/badge";

type PipelineCapabilitiesProps = {
  capabilities: readonly { label: string; values: readonly string[] }[];
};

export function PipelineCapabilities({ capabilities }: PipelineCapabilitiesProps) {
  if (capabilities.length === 0) return null;

  return (
    <section className="border-t pt-4" aria-label="Capacités disponibles">
      <p className="text-xs font-medium">Capacités disponibles</p>
      <p className="mt-1 text-xs text-muted-foreground">Informations fournies par l&apos;implémentation actuelle et non modifiables.</p>
      <dl className="mt-3 space-y-3">
        {capabilities.map((capability) => (
          <div key={capability.label}>
            <dt className="text-xs text-muted-foreground">{capability.label}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {capability.values.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}