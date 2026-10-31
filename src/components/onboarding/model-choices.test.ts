import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Capability, Model, Provider } from "@/types/augmented-prisma";

import { modelChoices } from "./model-choices";

// Only the fields modelChoices reads.
const model = (name: string, capabilities: Capability[], enabled = true) =>
  ({ name, displayName: null, enabled, capabilities: capabilities.map((capability) => ({ name: capability })) }) as unknown as Model;

const provider = (id: string, models: Model[]) =>
  ({ id, name: id, enabled: true, models }) as unknown as Provider;

describe("model choices", () => {
  it("modelChoices keeps the models with the capability", () => {
    const anthropic = provider("a", [model("claude", ["GENERATION"]), model("off", ["GENERATION"], false)]);
    const voyage = provider("v", [model("voyage-4", ["EMBEDDING"])]);
    assert.deepEqual(modelChoices([anthropic, voyage], "GENERATION").map((choice) => choice.modelName), ["claude"]);
    assert.deepEqual(modelChoices([anthropic], "EMBEDDING"), []);
    assert.deepEqual(modelChoices([{ ...voyage, enabled: false }], "EMBEDDING"), []);
  });
});
