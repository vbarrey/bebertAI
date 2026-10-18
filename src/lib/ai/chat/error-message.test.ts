import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { userErrorMessage } from "./error-message";

// The shape of undici: TypeError("fetch failed") caused by the socket error.
function fetchFailed(code: string, port?: number, address = "127.0.0.1") {
  return new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code, port, address }) });
}

describe("userErrorMessage", () => {
  it("names the unreachable service from its port", () => {
    assert.equal(userErrorMessage(fetchFailed("ECONNREFUSED", 6333)), "La base vectorielle Qdrant n'est pas joignable : vérifiez que le service est démarré.");
    assert.equal(userErrorMessage(new Error("wrapped", { cause: fetchFailed("ECONNREFUSED", 11434) })), "Ollama n'est pas joignable : vérifiez que le service est démarré.");
  });

  it("reads the port in the attempts of an AggregateError (IPv6 then IPv4)", () => {
    const attempts = [
      Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED", address: "::1", port: 6333 }),
      Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED", address: "127.0.0.1", port: 6333 }),
    ];
    const error = new TypeError("fetch failed", { cause: Object.assign(new AggregateError(attempts), { code: "ECONNREFUSED" }) });

    assert.equal(userErrorMessage(error), "La base vectorielle Qdrant n'est pas joignable : vérifiez que le service est démarré.");
  });

  it("gives the address of an unknown service", () => {
    assert.equal(userErrorMessage(fetchFailed("ENOTFOUND", 8080, "api.example.com")), "Un service n'est pas joignable (api.example.com:8080) : vérifiez qu'il est démarré.");
  });

  it("keeps a provider message without its internal tags", () => {
    assert.equal(
      userErrorMessage(new Error("[PROVIDER ERROR] [OLLAMA] Réponse vide du modèle (done_reason: stop).")),
      "Réponse vide du modèle (done_reason: stop).",
    );
    assert.equal(userErrorMessage(new Error("Le modèle « x » (étape « génération ») est désactivé.")), "Le modèle « x » (étape « génération ») est désactivé.");
  });

  it("falls back to a generic message", () => {
    assert.equal(userErrorMessage("boom"), "La génération de la réponse a échoué.");
    assert.equal(userErrorMessage(new Error("[PROVIDER ERROR] ")), "La génération de la réponse a échoué.");
  });
});
