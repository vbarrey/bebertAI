import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectLanguage, FRENCH_ELISIONS, STOPWORDS } from "./language";

describe("detectLanguage", () => {
    it("detects each BM25 language", () => {
        const texts = {
            french: "Le contrat de maintenance est disponible dans le dossier partagé. Il couvre les locaux et les équipements pour une durée de trois ans.",
            english: "The maintenance contract is available in the shared folder. It covers the premises and the equipment for a period of three years.",
            german: "Der Wartungsvertrag ist im gemeinsamen Ordner verfügbar. Er deckt die Räume und die Ausrüstung für eine Dauer von drei Jahren ab.",
            russian: "Договор на обслуживание доступен в общей папке. Он охватывает помещения и оборудование на срок три года.",
        };

        for (const [language, text] of Object.entries(texts)) {
            assert.equal(detectLanguage(text), language);
        }
    });

    it("detects French with decomposed accents (NFD)", () => {
        // Without NFC, the three decomposed "à" are not stopwords and only "ou" is left: null.
        const text = "Rendez-vous à Paris, à Lyon ou à Lille.";

        assert.equal(detectLanguage(text.normalize("NFD")), "french");
    });

    it("counts French elisions", () => {
        // Only "l'", "d'", "qu'", "n'", "s'", "j'" and "à" are stopwords here.
        assert.equal(detectLanguage("J'ai vu l'armée qu'il n'aimait guère s'éloigner d'Orléans à l'aube."), "french");
    });

    it("does not take the English 's for a French elision", () => {
        assert.equal(detectLanguage("It's the company's car and it's parked at John's garage."), "english");
    });

    it("detects German containing was and will", () => {
        assert.equal(detectLanguage("Was der Kunde will, ist nicht immer das, was er braucht, und das ist auch gut so."), "german");
    });

    it("detects Russian full of Latin designations", () => {
        const text = "В 1943 году на танк Pz.Kpfw. IV Ausf. H установили пушку KwK 40 L/48, а двигатель Maybach HL 120 TRM остался прежним. Для экипажа это было важно, так как экраны Schürzen защищали от ПТР.";

        assert.equal(detectLanguage(text), "russian");
    });

    it("keeps the majority language of a text quoting another one", () => {
        const text = "Le rapport annuel présente les résultats de la société. Il cite le slogan « The best of both worlds » et le nom du projet « Data for the people ». Les chiffres sont en hausse pour la troisième année.";

        assert.equal(detectLanguage(text), "french");
    });

    it("returns null for a mixed text without a clear winner", () => {
        // 4 French and 4 English stopwords.
        assert.equal(detectLanguage("Le moteur est dans la caisse. The engine is with the box."), null);
    });

    it("returns null for OCR noise with stray Cyrillic letters", () => {
        // 4 Russian stopwords (а, с, в, и) among 129 words: 3%.
        const noise = Array.from({ length: 25 }, (_, i) => `INVNAU эр saogig ${i}р uIsesen`).join(" ") + " а с в и";

        assert.equal(detectLanguage(noise), null);
    });

    it("returns null when the text is too short to tell", () => {
        for (const text of ["", "facture_2024_03.png", "Rapport annuel", "Photo IMG 2041 Canon EOS", "Привет мир"]) {
            assert.equal(detectLanguage(text), null, text);
        }
    });
});

describe("STOPWORDS", () => {
    it("lists each word in a single language", () => {
        const words = [...Object.values(STOPWORDS).flat(), ...FRENCH_ELISIONS];

        assert.deepEqual(words.filter((word, index) => words.indexOf(word) !== index), []);
    });

    it("gives every language the same number of signals, ±2", () => {
        const sizes = Object.entries(STOPWORDS).map(([language, words]) =>
            words.length + (language === "french" ? FRENCH_ELISIONS.length : 0),
        );

        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 2, sizes.join(", "));
    });
});
