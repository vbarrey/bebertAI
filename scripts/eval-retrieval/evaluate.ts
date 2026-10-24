/**
 * Measures how well each retrieval setting finds the passage a question was written from.
 *
 * Usage: npm run eval:retrieval
 *
 * For every question of data/questions.json, runs the same Qdrant query as the chat (buildHybridQuery) under each
 * setting of SETTINGS, then checks where the source page ranks among the topK results. Read-only on the app data.
 * The first run embeds and translates every question like the chat does (cached in data/prepared.json).
 */
import { qdrant } from "@/lib/qdrant/client";
import { chunksCollection } from "@/lib/qdrant/collections";
import { embeddingContextLength } from "@/lib/rag/embedding/embedder";
import { buildHybridQuery } from "@/lib/rag/retrieval/hybrid-query";
import { translateQuery } from "@/lib/rag/retrieval/query-translator";
import type { PipelineParameters } from "@/lib/pipeline/parameters";

import {
    loadPipelineParameters,
    evaluationUserId,
    ollama,
    prisma,
    PREPARED_FILE,
    QUESTION_STYLES,
    QUESTIONS_FILE,
    readJson,
    writeJson,
    type EvaluationItem,
    type PreparedCache,
    type QuestionStyle,
} from "./common";

type Retrieval = PipelineParameters["retrieval"];

const withHybrid = (retrieval: Retrieval, hybrid: Partial<Retrieval["hybrid"]>): Retrieval =>
    ({ ...retrieval, hybrid: { ...retrieval.hybrid, enabled: true, ...hybrid } });

/**
 * The settings compared, each one a change of the retrieval parameters saved in the settings page.
 * Edit this list to test other values.
 */
const SETTINGS: { name: string; change: (retrieval: Retrieval) => Retrieval }[] = [
    { name: "réglages enregistrés", change: (retrieval) => retrieval },
    { name: "sémantique seule", change: (retrieval) => ({ ...retrieval, hybrid: { ...retrieval.hybrid, enabled: false } }) },
    ...[0.55, 0.45, 0.35].map((scoreThreshold) => ({
        name: `hybride, seuil sémantique ${scoreThreshold}`,
        change: (retrieval: Retrieval) => withHybrid({ ...retrieval, scoreThreshold }, {}),
    })),
    ...[0.5, 1, 2].map((sparseWeight) => ({
        name: `hybride, poids lexical ${sparseWeight}`,
        change: (retrieval: Retrieval) => withHybrid(retrieval, { sparseWeight }),
    })),
];

type Score = {
    // Source page among the topK results.
    pageFound: number;
    // Source document among the topK results, whatever the page.
    documentFound: number;
    // Sum of 1 / rank of the source page (0 when missing): its mean is the MRR.
    reciprocalRanks: number;
    // Same as pageFound, for passages in English or Russian: the question, always French, crosses languages.
    crossLanguageFound: number;
    crossLanguageTotal: number;
    // Results returned: below topK, the semantic threshold dropped some.
    results: number;
};

async function prepareQuestions(items: EvaluationItem[], parameters: PipelineParameters): Promise<PreparedCache> {
    const { translation } = parameters.retrieval.hybrid;
    // Same models as the chat; the conversation model translates when none is set, here the pipeline one.
    const translationModel = translation.modelName || parameters.generation.modelName;
    const embeddingModel = parameters.embedding.modelName;

    const cached = await readJson<PreparedCache>(PREPARED_FILE);
    const cache: PreparedCache = cached?.embeddingModel === embeddingModel && cached.translationModel === translationModel
        ? cached
        : { embeddingModel, translationModel, questions: {} };

    const provider = ollama();
    const missing = items.flatMap((item) => QUESTION_STYLES.map((style) => item.questions[style]))
        .filter((question) => !cache.questions[question]);

    for (const [index, question] of missing.entries()) {
        process.stdout.write(`\rPréparation des questions ${index + 1}/${missing.length}…`);

        const [vector] = await provider.embed({
            model: embeddingModel,
            input: [question.normalize("NFC")],
            contextLength: embeddingContextLength(parameters.chunking.chunkSize),
            cpuOnly: true,
        });

        cache.questions[question] = {
            vector: vector!,
            translations: await translateQuery(provider, translationModel, question.normalize("NFC")),
        };
    }

    if (missing.length > 0) {
        process.stdout.write("\n");
        await writeJson(PREPARED_FILE, cache);
    }

    return cache;
}

async function measure(
    items: EvaluationItem[],
    style: QuestionStyle,
    retrieval: Retrieval,
    parameters: PipelineParameters,
    prepared: PreparedCache,
    chunkById: Map<string, { documentId: string; pageNumber: number | null }>,
): Promise<Score> {
    const score: Score = { pageFound: 0, documentFound: 0, reciprocalRanks: 0, crossLanguageFound: 0, crossLanguageTotal: 0, results: 0 };

    for (const item of items) {
        const question = item.questions[style].normalize("NFC");
        const { vector, translations } = prepared.questions[item.questions[style]]!;

        const { points } = await qdrant.query(chunksCollection(await evaluationUserId()), buildHybridQuery({
            vector,
            query: question,
            translations,
            retrieval,
            sparse: parameters.embedding.sparse,
            chunkSize: parameters.chunking.chunkSize,
        }));

        const results = points.map((point) => chunkById.get((point.payload as { chunkId: string }).chunkId));
        const rank = results.findIndex((chunk) => chunk?.documentId === item.documentId && chunk.pageNumber === item.pageNumber);
        const crossLanguage = item.language === "english" || item.language === "russian";

        score.results += results.length;
        score.pageFound += rank >= 0 ? 1 : 0;
        score.reciprocalRanks += rank >= 0 ? 1 / (rank + 1) : 0;
        score.documentFound += results.some((chunk) => chunk?.documentId === item.documentId) ? 1 : 0;
        score.crossLanguageTotal += crossLanguage ? 1 : 0;
        score.crossLanguageFound += crossLanguage && rank >= 0 ? 1 : 0;
    }

    return score;
}

const percent = (part: number, total: number) => `${Math.round((part / total) * 100)} %`.padStart(6);

async function main() {
    const items = await readJson<EvaluationItem[]>(QUESTIONS_FILE);

    if (!items) {
        throw new Error(`${QUESTIONS_FILE} est absent : générez les questions avec npm run eval:questions.`);
    }

    const parameters = await loadPipelineParameters();
    const prepared = await prepareQuestions(items, parameters);
    // Results point to chunk ids: the page they are on comes from the database.
    const chunkById = new Map((await prisma.chunk.findMany({ select: { id: true, documentId: true, pageNumber: true } }))
        .map(({ id, ...chunk }) => [id, chunk]));

    console.log(`${items.length} passages, top ${parameters.retrieval.topK}, embedding ${prepared.embeddingModel}, traduction ${prepared.translationModel}`);

    for (const style of QUESTION_STYLES) {
        console.log(`\nQuestions ${style === "precise" ? "précises" : "vagues"}`);
        console.log(`${"réglage".padEnd(34)}  page  document   MRR   autre langue  résultats`);

        for (const setting of SETTINGS) {
            const score = await measure(items, style, setting.change(parameters.retrieval), parameters, prepared, chunkById);

            console.log([
                setting.name.padEnd(34),
                percent(score.pageFound, items.length),
                percent(score.documentFound, items.length).padStart(9),
                (score.reciprocalRanks / items.length).toFixed(3).padStart(6),
                `${score.crossLanguageFound}/${score.crossLanguageTotal}`.padStart(13),
                (score.results / items.length).toFixed(1).padStart(10),
            ].join(" "));
        }
    }
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
