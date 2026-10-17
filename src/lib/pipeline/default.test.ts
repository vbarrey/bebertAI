import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPipelineParameters, withDefaultModels } from "./default";

describe("withDefaultModels", () => {
    it("points the steps never configured to the given models", () => {
        const parameters = withDefaultModels(defaultPipelineParameters, {
            providerId: "ollama",
            embeddingModel: "qwen3-embedding:0.6b",
            generationModel: "qwen3:0.6b",
        });

        assert.equal(parameters.embedding.providerId, "ollama");
        assert.equal(parameters.embedding.modelName, "qwen3-embedding:0.6b");
        assert.deepEqual(parameters.embedding.sparse, defaultPipelineParameters.embedding.sparse);
        assert.equal(parameters.generation.providerId, "ollama");
        assert.equal(parameters.generation.modelName, "qwen3:0.6b");
    });

    it("keeps a step unset when its model is missing", () => {
        const parameters = withDefaultModels(defaultPipelineParameters, { providerId: "ollama", generationModel: "qwen3:0.6b" });

        assert.equal(parameters.embedding, defaultPipelineParameters.embedding);
        assert.equal(parameters.generation.modelName, "qwen3:0.6b");
    });

    it("returns the same parameters when the steps are configured", () => {
        const configured = {
            ...defaultPipelineParameters,
            embedding: { ...defaultPipelineParameters.embedding, providerId: "voyage", modelName: "voyage-4" },
            generation: { ...defaultPipelineParameters.generation, providerId: "anthropic", modelName: "claude" },
        };

        assert.equal(
            withDefaultModels(configured, { providerId: "ollama", embeddingModel: "qwen3-embedding:0.6b", generationModel: "qwen3:0.6b" }),
            configured,
        );
    });
});
