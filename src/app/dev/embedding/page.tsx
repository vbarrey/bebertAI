import { aiProviderRegistry } from "@/lib/ai/registry";

export default async  function EmbeddingPlayground() {
  const providerId = "cmsrrnux40000wguz6cmb7kpj";

  const provider = aiProviderRegistry.get(providerId);

  if(!provider || !provider.embed) throw new Error("Pas de provider où pas d'implémentation");

  const chunks = [
    "Les encres utilisées en imprimerie.",
    "Les différents types de papier.",
    "La mécanique d'une presse offset.",
  ];

  const embeddings = await provider.embed({model: "qwen3-embedding:4b", chunks});

  console.log("Provider =>", provider);
  console.log("Embeddings =>", embeddings);

  return (
    <div className="flex container max-w-full p-4">
      <h2 className="text-xl">{provider.name}</h2>
        <br />
        <div className="p-4 flex">
            {embeddings.map((e,i)=> {
                return (<p key={i}>{e}</p>)
            })}
        </div>
    </div>
  );
}
