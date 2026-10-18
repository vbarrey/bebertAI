// Shared with the chat UI: keep it free of server imports.

/** Link target of the citation of source n (1-based): read back by the Markdown link renderer. */
export const CITATION_PREFIX = "#source-";

// [1], [2, 3] or [2; 3], but neither a Markdown link [text](url) nor an image ![alt].
const BRACKETS = /(?<!!)\[(\d+(?:\s*[,;]\s*\d+)*)\](?!\()/g;
// "Extrait 3", the excerpt heading the model was given, also written "extrait n°3".
const EXCERPT = /\b([Ee]xtraits?)\s+(?:n°\s*)?(\d+)\b/g;

/**
 * The answer with its citations of sources as Markdown links to CITATION_PREFIX + n: "[2, 3]" becomes two links,
 * "Extrait 3" a link on those words. A number outside the sources stays as written.
 */
export function linkCitations(content: string, sourceCount: number): string {
  const isSource = (n: number) => n >= 1 && n <= sourceCount;

  return content
    .replace(BRACKETS, (match, numbers: string) => {
      const cited = numbers.split(/\s*[,;]\s*/).map(Number);
      return cited.every(isSource) ? cited.map((n) => `[${n}](${CITATION_PREFIX}${n})`).join("") : match;
    })
    .replace(EXCERPT, (match, word: string, number: string) =>
      isSource(Number(number)) ? `[${word} ${number}](${CITATION_PREFIX}${number})` : match);
}

/** The source number of a citation link, null for another link. */
export function citedSource(href: string | undefined): number | null {
  return href?.startsWith(CITATION_PREFIX) ? Number(href.slice(CITATION_PREFIX.length)) || null : null;
}
