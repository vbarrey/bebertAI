/**
 * Letters and digits only: whitespace, punctuation and stray glyphs do not make a text usable.
 */
export function countMeaningfulChars(text: string): number {
    return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

// Cyrillic letters drawn like a Latin one: OCR with Russian among its languages reads "X.7.232.355" as "Х.7.232.355".
const LATIN_LOOKALIKES: Record<string, string> = {
    А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", І: "I", Ѕ: "S", Ј: "J",
    а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ѕ: "s", ј: "j",
};

/**
 * Writes in Latin the words that mix Cyrillic lookalikes with digits or Latin letters (part numbers, "Т-54"),
 * so that BM25 matches them as typed on a Latin keyboard. A word with another Cyrillic letter is Russian
 * ("37-мм", "1,5-тонного") and is kept.
 */
export function latinizeLookalikes(text: string): string {
    return text.replace(/\S+/g, (word) => {
        if (!/[Ѐ-ӿ]/.test(word) || !/[0-9A-Za-z]/.test(word)) {
            return word;
        }

        const letters = [...word];

        return letters.every((letter) => !/[Ѐ-ӿ]/.test(letter) || letter in LATIN_LOOKALIKES)
            ? letters.map((letter) => LATIN_LOOKALIKES[letter] ?? letter).join("")
            : word;
    });
}

/** Extracted text as every later step expects it. */
export function normalizeExtractedText(text: string): string {
    // PDF and OCR text may hold decomposed accents (e + combining acute): Qdrant BM25 does not match them
    // with the composed form the questions are typed in.
    return latinizeLookalikes(text.normalize("NFC"));
}
