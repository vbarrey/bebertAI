import type { AIProviderClient } from "@/lib/ai/provider";
import { BM25_LANGUAGES, type Bm25Language } from "@/lib/pipeline/parameters";

export type QueryTranslations = Record<Bm25Language, string>;

const SYSTEM_PROMPT = `You translate search queries for a multilingual document search engine.
Translate the user's query into ${BM25_LANGUAGES.map((language) => language[0]!.toUpperCase() + language.slice(1)).join(", ")}.
Keep part numbers, model designations, proper nouns and units unchanged (e.g. "Celtaquatre", "Pz.Kpfw. IV", "7.232.355").
Translate only: do not answer the query, do not add words.`;

// Ollama constrains the answer to this schema: one translation per BM25 language.
const FORMAT = {
    type: "object",
    properties: Object.fromEntries(BM25_LANGUAGES.map((language) => [language, { type: "string" }])),
    required: [...BM25_LANGUAGES],
};

// A query is a sentence or two: this only stops a runaway answer.
const MAX_TOKENS = 1024;

/**
 * The query in each BM25 language, for the lexical search of each language. Never fails: a language the model
 * did not translate, or every language when the model fails, keeps the query as it was typed.
 */
export async function translateQuery(
    provider: AIProviderClient,
    modelName: string,
    query: string,
): Promise<QueryTranslations> {
    let answer = "";

    try {
        for await (const chunk of provider.chat({
            modelName,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: query },
            ],
            temperature: 0,
            maxTokens: MAX_TOKENS,
            // Reasoning would only add latency to a translation.
            think: false,
            format: FORMAT,
        })) {
            answer += chunk.content;
        }
    } catch (error) {
        console.warn(`[QueryTranslator] Translation failed with ${modelName}, the query is searched as typed:`, error);
    }

    let translations: Record<string, unknown> = {};

    try {
        const parsed: unknown = JSON.parse(answer);

        if (parsed && typeof parsed === "object") {
            translations = parsed as Record<string, unknown>;
        }
    } catch {
        if (answer) {
            console.warn(`[QueryTranslator] ${modelName} did not answer JSON, the query is searched as typed: ${answer.slice(0, 200)}`);
        }
    }

    return Object.fromEntries(BM25_LANGUAGES.map((language) => {
        const translation = translations[language];

        // NFC like the indexed chunks: BM25 only matches identical forms.
        return [
            language,
            typeof translation === "string" && translation.trim() ? translation.trim().normalize("NFC") : query,
        ];
    })) as QueryTranslations;
}
