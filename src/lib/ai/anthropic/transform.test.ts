import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toAnthropicChatRequest } from "./transform";

describe("toAnthropicChatRequest", () => {
    it("moves the system messages to the system prompt and drops the temperature", () => {
        const request = toAnthropicChatRequest({
            modelName: "claude-opus-5-5",
            messages: [
                { role: "system", content: "Réponds en français." },
                { role: "user", content: "Bonjour" },
                { role: "assistant", content: "Bonjour !" },
                { role: "user", content: "Ça va ?" },
            ],
            temperature: 0.7,
            maxTokens: 1000,
        });

        assert.equal(request.system, "Réponds en français.");
        assert.deepEqual(request.messages.map((message) => message.role), ["user", "assistant", "user"]);
        assert.equal(request.max_tokens, 1000);
        assert.equal("temperature" in request, false);
        assert.equal("thinking" in request, false);
    });

    it("closes the JSON schema and asks for thinking only when wanted", () => {
        const request = toAnthropicChatRequest({
            modelName: "m",
            messages: [{ role: "user", content: "q" }],
            think: true,
            format: { type: "object", properties: { fr: { type: "string" } }, required: ["fr"] },
        });

        assert.deepEqual(request.thinking, { type: "adaptive" });
        assert.deepEqual(request.output_config?.format, {
            type: "json_schema",
            schema: { additionalProperties: false, type: "object", properties: { fr: { type: "string" } }, required: ["fr"] },
        });
        assert.equal(request.max_tokens, 16000);
    });
});
