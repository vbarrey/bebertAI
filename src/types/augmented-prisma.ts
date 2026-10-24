import { AIModel, AIModelCapability, AIProvider, Capability as P_Capability } from "@prisma/client";

export type Capability = P_Capability;
export const Capability = P_Capability;

// isDefault: a default model of Ollama local (.env), which cannot be deleted.
export type Model = AIModel & { capabilities?: AIModelCapability[]; isDefault?: boolean };

// manageable: the signed-in user can change it (their own, or the shared Ollama local for the admin).
export type Provider = AIProvider & { models?: Model[]; manageable?: boolean };
