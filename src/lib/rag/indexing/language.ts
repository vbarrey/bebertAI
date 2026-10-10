import type { Bm25Language } from "@/lib/pipeline/parameters";

// Frequent function words specific to one language: words shared by two of them (in, an, des, on...) are left out.
const STOPWORDS: Record<Exclude<Bm25Language, "russian">, ReadonlySet<string>> = {
    french: new Set([
        "le", "la", "les", "du", "de", "et", "est", "une", "un", "dans", "pour", "que", "qui", "sur",
        "pas", "par", "avec", "au", "aux", "ce", "cette", "sont", "il", "elle", "nous", "vous", "ne", "se",
        "en", "été", "être", "leur", "ou", "mais",
    ]),
    english: new Set([
        "the", "and", "of", "to", "is", "that", "it", "for", "with", "as", "are", "this", "be", "by",
        "was", "not", "or", "at", "from", "which", "have", "has", "you", "we", "they", "will", "can",
        "been", "were", "their",
    ]),
    german: new Set([
        "der", "die", "das", "und", "ist", "nicht", "mit", "den", "dem", "ein", "eine", "einer", "zu",
        "von", "auf", "für", "sich", "auch", "es", "im", "wird", "werden", "sind", "wir", "ich", "oder",
        "bei", "aus", "nach", "wie",
    ]),
};

// Below this, a file name or a few words: the guess would be noise.
const MIN_STOPWORDS = 3;
const MIN_CYRILLIC_LETTERS = 20;
// Enough words to decide on a whole document while keeping long ones cheap.
const MAX_WORDS = 5000;

/** Main language of a document text, or null when it is too short to tell. */
export function detectLanguage(text: string): Bm25Language | null {
    const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []).slice(0, MAX_WORDS);

    let cyrillic = 0;
    let latin = 0;

    for (const word of words) {
        if (/\p{Script=Cyrillic}/u.test(word)) cyrillic += word.length;
        else if (/\p{Script=Latin}/u.test(word)) latin += word.length;
    }

    if (cyrillic >= MIN_CYRILLIC_LETTERS && cyrillic > latin) {
        return "russian";
    }

    const counts = Object.entries(STOPWORDS)
        .map(([language, stopwords]) => ({
            language: language as Bm25Language,
            count: words.filter((word) => stopwords.has(word)).length,
        }))
        .sort((a, b) => b.count - a.count);

    const [best, second] = counts;

    if (!best || best.count < MIN_STOPWORDS || best.count === second?.count) {
        return null;
    }

    return best.language;
}
