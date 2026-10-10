import { BM25_LANGUAGES, type Bm25Language, type PipelineParameters } from "@/lib/pipeline/parameters";

type SparseParameters = PipelineParameters["embedding"]["sparse"];

// One sparse vector per language, plus one without stemmer for the chunks whose language could not be detected.
export const SPARSE_VECTOR_NAMES: readonly string[] = [...BM25_LANGUAGES, null].map(sparseVectorName);

export function sparseVectorName(language: Bm25Language | null): string {
    return `bm25_${language ?? "none"}`;
}

// Measured on the indexed documents: chunks fill about 2/3 of chunkSize, at 7 characters per word,
// and a third of the words are stopwords dropped by BM25.
const CHARS_PER_BM25_TOKEN = 16;

/** Text that Qdrant turns into a BM25 sparse vector: indexing and queries must share these options. */
export function bm25Document(
    text: string,
    language: Bm25Language | null,
    sparse: SparseParameters,
    chunkSize: number,
) {
    return {
        text,
        model: "qdrant/bm25",
        options: {
            k: sparse.k,
            b: sparse.b,
            avg_len: Math.max(1, Math.round(chunkSize / CHARS_PER_BM25_TOKEN)),
            ascii_folding: sparse.asciiFolding,
            // Without a language Qdrant assumes English: an unknown language gets neither stemmer nor stopwords.
            ...(language
                ? { language }
                : { stemmer: { type: "none" }, stopwords: { languages: [], custom: [] } }),
        },
    };
}
