/**
 * Shared by the retrieval evaluation scripts: data files, their types and the app objects they need.
 * Run the scripts from the repository root (npm run eval:questions / eval:retrieval).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { OllamaLocalProvider } from "@/lib/ai/ollama-local/provider";
import { prisma } from "@/lib/prisma";
import { PipelineParametersSchema, type PipelineParameters } from "@/lib/pipeline/parameters";
import type { QueryTranslations } from "@/lib/rag/retrieval/query-translator";

// Generated from the local documents: kept out of git (see .gitignore).
export const DATA_DIR = path.join(process.cwd(), "scripts", "eval-retrieval", "data");
export const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
export const PREPARED_FILE = path.join(DATA_DIR, "prepared.json");

// precise: reuses the exact terms of the passage (names, references); vague: everyday words, no reference.
export const QUESTION_STYLES = ["precise", "vague"] as const;
export type QuestionStyle = (typeof QUESTION_STYLES)[number];

/** One sampled passage and the questions it answers. Found means a result on the same document and page. */
export type EvaluationItem = {
    documentId: string;
    documentName: string;
    pageNumber: number | null;
    // BM25 language of the passage: tells whether the question crosses languages.
    language: string | null;
    questions: Record<QuestionStyle, string>;
};

/** What the chat computes before searching, cached per question since it does not depend on the settings. */
export type PreparedQuestion = {
    vector: number[];
    translations: QueryTranslations;
};

export type PreparedCache = {
    // A cache built with other models is rebuilt.
    embeddingModel: string;
    translationModel: string;
    questions: Record<string, PreparedQuestion>;
};

export async function readJson<T>(file: string): Promise<T | null> {
    return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) as T : null;
}

export async function writeJson(file: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value, null, 2));
}

/** The pipeline parameters saved in the settings page: the evaluation starts from what the chat uses. */
export async function loadPipelineParameters(): Promise<PipelineParameters> {
    const stored = await prisma.pipelineParameters.findUniqueOrThrow({ where: { id: 1 } });

    return PipelineParametersSchema.parse(JSON.parse(stored.parameters));
}

export function ollama(): OllamaLocalProvider {
    return new OllamaLocalProvider("ollama", "Ollama", {
        host: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
        defaultModel: "",
    });
}

/** Argument value of `--name value`, or the fallback. */
export function argument(name: string, fallback: string): string {
    const index = process.argv.indexOf(`--${name}`);

    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

export { prisma };
