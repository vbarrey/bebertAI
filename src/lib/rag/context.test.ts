import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRagContext, joinChunks } from "./context";
import { RecursiveCharacterChunker } from "./indexing/chunkers/RecursiveChunker";
import type { RetrievedChunk } from "./retrieval/retriever";

const chunk = (fields: Partial<RetrievedChunk> & Pick<RetrievedChunk, "position" | "content">): RetrievedChunk => ({
    chunkId: `c${fields.position}`,
    documentId: "catalogue",
    documentName: "Catalogue Celtaquatre.pdf",
    pageNumber: 12,
    score: 0.8,
    ...fields,
});

// Context without the instructions paragraph.
const excerpts = (context: string) => context.slice(context.indexOf("### "));

describe("joinChunks", () => {
    it("rebuilds the original text from the chunker output", async () => {
        const text = Array.from({ length: 30 }, (_, index) =>
            `X.6.011.${200 + index} - Soupape numéro ${index} du moteur`).join("\n");

        const chunks = await new RecursiveCharacterChunker({ chunkSize: 200, chunkOverlap: 60 })
            .chunk({ blocks: [{ text }] });

        assert.ok(chunks.length > 3);
        assert.equal(chunks.map((c) => c.text).reduce(joinChunks), text);
    });

    it("keeps both texts when they do not overlap", () => {
        assert.equal(joinChunks("Soupape d'admission", "Ressort de soupape"), "Soupape d'admission\nRessort de soupape");
    });
});

describe("buildRagContext", () => {
    it("is empty without chunks", () => {
        assert.equal(buildRagContext([]), "");
    });

    it("tells the model the excerpts are partial", () => {
        assert.match(buildRagContext([chunk({ position: 0, content: "Texte" })]), /la fin d'un extrait n'est pas la fin du document/);
    });

    it("merges consecutive chunks into one excerpt with its document and pages", () => {
        const context = buildRagContext([
            chunk({ position: 4, content: "Fin de la page 12, partie commune avec la suite.", pageNumber: 12 }),
            chunk({ position: 3, content: "Début de la page 12. Fin de la page 12, partie commune", pageNumber: 12 }),
            chunk({ position: 5, content: "Page 13.", pageNumber: 13 }),
        ]);

        assert.equal(
            excerpts(context),
            "### Extrait 1 — Catalogue Celtaquatre.pdf, pages 12 à 13\n\n" +
            "Début de la page 12. Fin de la page 12, partie commune avec la suite.\n\nPage 13.",
        );
    });

    it("keeps separate excerpts for gaps and other documents, the most relevant first", () => {
        const context = buildRagContext([
            chunk({ position: 1, content: "Peu pertinent", score: 0.6 }),
            chunk({ position: 8, content: "Très pertinent", score: 0.9 }),
            chunk({ position: 2, content: "Image", documentId: "photo", documentName: "char.png", pageNumber: null, score: 0.7 }),
        ]);

        assert.equal(
            excerpts(context),
            "### Extrait 1 — Catalogue Celtaquatre.pdf, page 12\n\nTrès pertinent\n\n" +
            "### Extrait 2 — char.png\n\nImage\n\n" +
            "### Extrait 3 — Catalogue Celtaquatre.pdf, page 12\n\nPeu pertinent",
        );
    });
});
