/**
 * Can chunks embedded by Ollama on this machine be searched with queries embedded by a remote provider serving the
 * same model? Phase 0 of the import/export: documents indexed locally, questions asked on the web.
 *
 * Usage (Ollama running, the models pulled, the key of the remote provider in COMPAT_API_KEY):
 *   npm run eval:compat -- [--ollama-models qwen3-embedding:4b,qwen3-embedding:4b-fp16]
 *                          [--provider-url https://openrouter.ai/api/v1] [--provider-model qwen/qwen3-embedding-4b]
 *
 * Every chunk of the local database is embedded by each encoder, then for each question of
 * scripts/eval-retrieval/data/questions.json the chunks are ranked by cosine in memory. Reported:
 * - the cosine between the two encoders on the same texts (1: identical vectors);
 * - the source page among the top 5 and the MRR, for documents and queries embedded by the same or different encoders;
 * - the Ollama throughput, for the duration of a big local indexing.
 * Read-only on the app data; the remote provider costs about 0.02 $ per run.
 */
import "dotenv/config";

import { embeddingQueryText } from "@/lib/rag/embedding/embedder";

import { argument, prisma, QUESTION_STYLES, QUESTIONS_FILE, readJson, type EvaluationItem } from "./eval-retrieval/common";

const OLLAMA_URL = argument("ollama-url", "http://localhost:11434");
const OLLAMA_MODELS = argument("ollama-models", "qwen3-embedding:4b,qwen3-embedding:4b-q8_0,qwen3-embedding:4b-fp16").split(",");
const PROVIDER_URL = argument("provider-url", "https://openrouter.ai/api/v1");
const PROVIDER_MODEL = argument("provider-model", "qwen/qwen3-embedding-4b");
const PROVIDER_KEY = process.env.COMPAT_API_KEY;
const TOP_K = 5;

type Encoder = { name: string; embed: (texts: string[]) => Promise<number[][]> };

function normalize(vector: number[]): Float32Array {
    const norm = Math.hypot(...vector);
    return Float32Array.from(vector, (value) => value / norm);
}

function cosine(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
    return sum;
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}, attempt = 1): Promise<T> {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
    if (response.ok) return response.json();

    const error = `${url} : ${response.status} ${await response.text()}`;
    // On Windows, Ollama runs out of local ports after a few thousand texts ("lacked sufficient buffer space"):
    // the closed connections are freed after a while.
    if (attempt >= 5) throw new Error(error);
    console.warn(`\n  ${error}\n  nouvel essai dans 30 s`);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    return postJson<T>(url, body, headers, attempt + 1);
}

const ollama = (model: string): Encoder => ({
    name: model,
    embed: async (input) => (await postJson<{ embeddings: number[][] }>(`${OLLAMA_URL}/api/embed`, { model, input })).embeddings,
});

const provider: Encoder = {
    name: `${PROVIDER_MODEL} (distant)`,
    embed: async (input) => {
        const { data } = await postJson<{ data: { index: number; embedding: number[] }[] }>(`${PROVIDER_URL}/embeddings`, { model: PROVIDER_MODEL, input }, { Authorization: `Bearer ${PROVIDER_KEY}` });
        return data.sort((a, b) => a.index - b.index).map(({ embedding }) => embedding);
    },
};

async function embedAll(encoder: Encoder, texts: string[]): Promise<{ vectors: Float32Array[]; seconds: number }> {
    const start = performance.now();
    const vectors: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += 32) {
        vectors.push(...(await encoder.embed(texts.slice(i, i + 32))).map(normalize));
        process.stdout.write(`\r  ${encoder.name} : ${vectors.length}/${texts.length}`);
    }
    process.stdout.write("\n");

    return { vectors, seconds: (performance.now() - start) / 1000 };
}

const percent = (value: number) => `${(value * 100).toFixed(0)} %`;

async function main() {
    if (!PROVIDER_KEY) throw new Error("COMPAT_API_KEY manquant : la clé du fournisseur distant.");

    const allItems = await readJson<EvaluationItem[]>(QUESTIONS_FILE);
    if (!allItems) throw new Error(`${QUESTIONS_FILE} introuvable : lancez d'abord npm run eval:questions.`);

    const chunks = (await prisma.chunk.findMany({ select: { text: true, pageNumber: true, document: { select: { displayName: true } } } }))
        .map(({ text, pageNumber, document }) => ({ text, pageNumber, documentName: document.displayName }));
    // By name and page: the documents were reimported since the questions were written, under new ids.
    const isSource = (chunk: (typeof chunks)[number], item: EvaluationItem) =>
        chunk.documentName === item.documentName && chunk.pageNumber === item.pageNumber;
    const items = allItems.filter((item) => chunks.some((chunk) => isSource(chunk, item)));
    const questions = items.flatMap((item) => QUESTION_STYLES.map((style) => ({ item, style, text: embeddingQueryText(PROVIDER_MODEL, item.questions[style]) })));
    console.log(`${chunks.length} chunks, ${questions.length} questions (${allItems.length - items.length} passages introuvables ignorés)\n`);

    const encoders = [...OLLAMA_MODELS.map(ollama), provider];
    const docs = new Map<string, Float32Array[]>();
    const queries = new Map<string, Float32Array[]>();
    const seconds = new Map<string, number>();

    for (const encoder of encoders) {
        const embedded = await embedAll(encoder, chunks.map(({ text }) => text));
        docs.set(encoder.name, embedded.vectors);
        seconds.set(encoder.name, embedded.seconds);
        queries.set(encoder.name, (await embedAll(encoder, questions.map(({ text }) => text))).vectors);
    }

    console.log(`\nDimension : ${docs.get(provider.name)![0]!.length} (distant), ${OLLAMA_MODELS.map((m) => docs.get(m)![0]!.length).join(" / ")} (Ollama)`);

    console.log("\nCosinus Ollama / distant sur les mêmes textes (moyenne, minimum) :");
    for (const model of OLLAMA_MODELS) {
        for (const [label, vectors] of [["chunks", docs], ["questions", queries]] as const) {
            const values = vectors.get(model)!.map((vector, i) => cosine(vector, vectors.get(provider.name)![i]!));
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            console.log(`  ${model.padEnd(28)} ${label.padEnd(10)} ${mean.toFixed(4)}  ${Math.min(...values).toFixed(4)}`);
        }
    }

    console.log(`\nRecherche : page source dans le top ${TOP_K} (précises / vagues), MRR`);
    const combos = [
        ...OLLAMA_MODELS.flatMap((model) => [[model, model], [model, provider.name]]),
        [provider.name, provider.name],
    ];
    for (const [docEncoder, queryEncoder] of combos) {
        const found = { precise: 0, vague: 0 };
        let reciprocalRanks = 0;

        questions.forEach(({ item, style }, q) => {
            const query = queries.get(queryEncoder!)![q]!;
            const ranked = docs.get(docEncoder!)!
                .map((vector, i) => ({ i, score: cosine(vector, query) }))
                .sort((a, b) => b.score - a.score);
            const rank = ranked.findIndex(({ i }) => isSource(chunks[i]!, item)) + 1;

            if (rank > 0 && rank <= TOP_K) found[style]++;
            if (rank > 0) reciprocalRanks += 1 / rank;
        });

        console.log(`  docs ${docEncoder!.padEnd(28)} requêtes ${queryEncoder!.padEnd(34)} ${percent(found.precise / items.length)} / ${percent(found.vague / items.length)}  MRR ${(reciprocalRanks / questions.length).toFixed(3)}`);
    }

    console.log("\nDébit d'indexation (chunks par seconde) :");
    for (const encoder of encoders) {
        console.log(`  ${encoder.name.padEnd(34)} ${(chunks.length / seconds.get(encoder.name)!).toFixed(1)}`);
    }
}

main().finally(() => prisma.$disconnect());
