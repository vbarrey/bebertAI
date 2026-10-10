import type { Bm25Language } from "@/lib/pipeline/parameters";

// Frequent function words of one language that are not frequent words of another one: shared or ambiguous
// words (in, an, des, on, du, was, will, a, am...) are left out. 32 signals per language, the French elisions
// included, so no language wins by having a longer list. language.test.ts checks that no word is listed twice.
// Russian is detected like the others: counting Cyrillic letters let Latin designations (Pz.Kpfw. IV, KwK 40)
// outweigh the Russian text around them.
export const STOPWORDS: Record<Bm25Language, readonly string[]> = {
    french: [
        "de", "la", "le", "et", "les", "en", "un", "une", "que", "est", "pour", "qui", "dans", "par",
        "pas", "au", "sur", "ne", "se", "ce", "il", "sont", "avec", "aux", "à", "ou",
    ],
    english: [
        "the", "and", "of", "to", "is", "that", "it", "for", "with", "as", "are", "this", "be", "by",
        "not", "or", "at", "from", "which", "have", "has", "you", "we", "they", "can", "been", "were",
        "their", "would", "there", "his", "but",
    ],
    german: [
        "der", "die", "das", "und", "ist", "nicht", "mit", "den", "dem", "ein", "eine", "einer", "zu",
        "von", "auf", "für", "sich", "auch", "es", "im", "wird", "werden", "sind", "wir", "ich", "oder",
        "bei", "aus", "nach", "wie", "dass", "noch",
    ],
    russian: [
        "и", "в", "не", "на", "с", "что", "по", "как", "к", "из", "за", "от", "о", "для", "это", "он",
        "но", "а", "у", "так", "же", "его", "при", "до", "был", "то", "все", "бы", "или", "она", "они",
        "было",
    ],
};

// Counted only before an apostrophe ("l'armée" → "l"): English splits "it's" or "company's" the same way,
// so a bare "s" or "d" after an apostrophe says nothing.
export const FRENCH_ELISIONS: readonly string[] = ["l", "d", "qu", "n", "s", "j"];

const STOPWORD_LANGUAGES = new Map<string, Bm25Language>(
    (Object.entries(STOPWORDS) as [Bm25Language, readonly string[]][])
        .flatMap(([language, words]) => words.map((word) => [word, language] as const)),
);

const ELISIONS = new Set(FRENCH_ELISIONS);

// Tuned for chunks: a 300 character chunk (~50 words) of running text has about 10 of these words,
// a 200-500 word chunk 40 or more. Below 3, it is a title, a table row or a part reference: the
// document language is a better guess.
const MIN_STOPWORDS = 3;
// Share of the words that must be stopwords of the winner. Running text is at 10-40% (Russian, with fewer
// function words, lowest); OCR noise of an upside-down scan is at 1-3% and its stray Cyrillic letters
// (а, с, в, и) would otherwise make it Russian. Measured on the indexed documents: 5% drops all the noise.
const MIN_STOPWORD_DENSITY = 0.05;
// The winner must clearly lead: a text quoting as much English as it has French is undecided.
const MIN_WIN_RATIO = 1.5;
// Enough words to decide on a whole document while keeping long ones cheap.
const MAX_WORDS = 5000;

/** Main language of a text, or null when it is too short or too mixed to tell. */
export function detectLanguage(text: string): Bm25Language | null {
    // PDF and OCR text may hold decomposed accents (u + combining diaeresis), which \p{L} alone splits.
    const tokens = (text.normalize("NFC").toLowerCase().match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? [])
        .slice(0, MAX_WORDS);

    const counts: Record<Bm25Language, number> = { french: 0, english: 0, german: 0, russian: 0 };

    for (const token of tokens) {
        const parts = token.split(/['’]/);

        parts.forEach((part, index) => {
            const isElision = index < parts.length - 1 && ELISIONS.has(part);
            const language = isElision ? "french" : STOPWORD_LANGUAGES.get(part);

            if (language) counts[language]++;
        });
    }

    const [best, second] = (Object.entries(counts) as [Bm25Language, number][])
        .sort(([, a], [, b]) => b - a);

    if (
        !best ||
        best[1] < MIN_STOPWORDS ||
        best[1] < MIN_STOPWORD_DENSITY * tokens.length ||
        best[1] < MIN_WIN_RATIO * (second?.[1] ?? 0)
    ) {
        return null;
    }

    return best[0];
}
