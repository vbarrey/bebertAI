import { AIModel, AIModelCapability, AIProvider, Capability as P_Capability } from "@prisma/client";

export type Capability = P_Capability;
export const Capability = P_Capability;

// isDefault: a default model of Ollama local (.env), which cannot be deleted.
export type Model = AIModel & { capabilities?: AIModelCapability[]; isDefault?: boolean };

export type Provider = AIProvider & { models?: Model[] };
