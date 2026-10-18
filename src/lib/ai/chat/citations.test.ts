import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { citedSource, linkCitations } from "./citations";

describe("linkCitations", () => {
  it("links bracketed source numbers, alone or grouped", () => {
    assert.equal(linkCitations("Le pare-chocs [1].", 3), "Le pare-chocs [1](#source-1).");
    assert.equal(linkCitations("Chromé [2][3]", 3), "Chromé [2](#source-2)[3](#source-3)");
    assert.equal(linkCitations("Voir [1, 3] et [2; 3]", 3), "Voir [1](#source-1)[3](#source-3) et [2](#source-2)[3](#source-3)");
  });

  it("links the excerpt mentions", () => {
    assert.equal(
      linkCitations("D'après l'Extrait 3 et les extraits n°2", 3),
      "D'après l'[Extrait 3](#source-3) et les [extraits 2](#source-2)",
    );
  });

  it("leaves numbers outside the sources, links and images as written", () => {
    assert.equal(linkCitations("Note [4] et Extrait 9", 3), "Note [4] et Extrait 9");
    assert.equal(linkCitations("Voir [1, 5]", 3), "Voir [1, 5]");
    assert.equal(linkCitations("[2](https://example.com) ![1](image.png)", 3), "[2](https://example.com) ![1](image.png)");
    assert.equal(linkCitations("Sans source [1]", 0), "Sans source [1]");
  });
});

describe("citedSource", () => {
  it("reads the source number of a citation link only", () => {
    assert.equal(citedSource("#source-2"), 2);
    assert.equal(citedSource("https://example.com"), null);
    assert.equal(citedSource(undefined), null);
  });
});
