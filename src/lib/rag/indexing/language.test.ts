import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectLanguage } from "./language";

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

    it("keeps the majority language of a document quoting another one", () => {
        const text = "Le rapport annuel présente les résultats de la société. Il cite le slogan « The best of both worlds » et le nom du projet « Data for the people ». Les chiffres sont en hausse pour la troisième année.";

        assert.equal(detectLanguage(text), "french");
    });

    it("detects Russian mixed with Latin terms", () => {
        const text = "Настройка сервера Qdrant и индексация документов выполняются через API. Документы обрабатываются каждую ночь.";

        assert.equal(detectLanguage(text), "russian");
    });

    it("returns null when the text is too short to tell", () => {
        for (const text of ["", "facture_2024_03.png", "Rapport annuel", "Photo IMG 2041 Canon EOS", "Привет мир"]) {
            assert.equal(detectLanguage(text), null, text);
        }
    });
});
