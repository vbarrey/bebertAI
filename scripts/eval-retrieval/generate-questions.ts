/**
 * Builds the evaluation set: samples passages from the indexed documents and asks a model to write,
 * for each one, the questions a user would ask to find it (one precise, one vague, both in French).
 *
 * Usage: npm run eval:questions -- [--count 40] [--model ministral-3:8b] [--force]
 *
 * The set is the ruler of every later measure: regenerating it makes results incomparable with the
 * previous ones, hence --force to overwrite an existing set. Reads the database, writes data/questions.json.
 */
import { detectLanguage } from "@/lib/rag/indexing/language";
import { countMeaningfulChars } from "@/lib/rag/indexing/text";

import {
    argument,
    loadPipelineParameters,
    ollama,
    prisma,
    QUESTIONS_FILE,
    readJson,
    writeJson,
    type EvaluationItem,
    type QuestionStyle,
} from "./common";

const CONTEXT = "Voici un extrait d'un document technique ancien (automobile, véhicules militaires).";

const PROMPTS: Record<QuestionStyle, string> = {
    precise: `${CONTEXT}
Écris UNE question courte et précise, en français, à laquelle cet extrait répond, comme la poserait un utilisateur qui ne voit pas l'extrait.
Utilise les termes précis de l'extrait (noms, modèles, références, valeurs) quand il y en a. Réponds uniquement par la question, sans mise en forme.`,
    vague: `${CONTEXT}
Écris UNE question en français à laquelle cet extrait répond, comme la taperait rapidement un utilisateur pressé qui ne connaît pas le document :
- moins de 12 mots, formulation simple et générale ;
- n'utilise PAS les termes techniques exacts de l'extrait : prends des mots courants ou des synonymes ;
- aucune référence, aucun numéro de pièce, aucune valeur chiffrée.
Réponds uniquement par la question, sans mise en forme.`,
};

// A passage worth a question: enough text, and a detected language (OCR noise has none).
const MIN_PASSAGE_CHARS = 300;
// Every document gets questions, even a short one.
const MIN_PER_DOCUMENT = 2;

// Same seed, same sample: the set can be rebuilt identically from the same index.
function seededRandom(seed: number): () => number {
    return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

async function ask(model: string, prompt: string, passage: string): Promise<string> {
    let answer = "";

    for await (const chunk of ollama().chat({
        modelName: model,
        temperature: 0,
        think: false,
        maxTokens: 120,
        messages: [{ role: "system", content: prompt }, { role: "user", content: passage }],
    })) {
        answer += chunk.content;
    }

    // Models add markdown and quotes despite the prompt.
    return answer.replace(/\*+/g, "").trim().replace(/^["«\s]+|["»\s]+$/g, "");
}

async function main() {
    if (await readJson(QUESTIONS_FILE) && !process.argv.includes("--force")) {
        throw new Error(`${QUESTIONS_FILE} existe déjà : --force pour le remplacer (les mesures précédentes ne seront plus comparables).`);
    }

    const count = Number(argument("count", "40"));
    const model = argument("model", (await loadPipelineParameters()).generation.modelName);
    const random = seededRandom(42);

    const documents = await prisma.document.findMany({ include: { chunks: { orderBy: { position: "asc" } } } });
    const passagesByDocument = documents
        .map((document) => ({
            document,
            passages: document.chunks.filter((chunk) =>
                countMeaningfulChars(chunk.text) >= MIN_PASSAGE_CHARS && detectLanguage(chunk.text) !== null),
        }))
        .filter(({ passages }) => passages.length > 0);
    const totalPassages = passagesByDocument.reduce((total, { passages }) => total + passages.length, 0);

    const items: EvaluationItem[] = [];

    for (const { document, passages } of passagesByDocument) {
        // Proportional to the document size, so a big catalogue weighs more than a leaflet.
        const share = Math.max(MIN_PER_DOCUMENT, Math.round((count * passages.length) / totalPassages));
        const sample = [...passages].sort(() => random() - 0.5).slice(0, share);

        for (const passage of sample) {
            const item: EvaluationItem = {
                documentId: document.id,
                documentName: document.displayName,
                pageNumber: passage.pageNumber,
                language: passage.language,
                questions: {
                    precise: await ask(model, PROMPTS.precise, passage.text),
                    vague: await ask(model, PROMPTS.vague, passage.text),
                },
            };

            items.push(item);
            console.log(`${document.displayName.slice(0, 24).padEnd(24)} p.${String(passage.pageNumber).padStart(3)}  ${item.questions.precise}\n${"".padEnd(31)}${item.questions.vague}`);
        }
    }

    await writeJson(QUESTIONS_FILE, items);
    console.log(`\n${items.length} passages, ${items.length * 2} questions → ${QUESTIONS_FILE}`);
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
