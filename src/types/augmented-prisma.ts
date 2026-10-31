import { AIModel, AIModelCapability, AIProvider, Capability as P_Capability } from "@prisma/client";

export type Capability = P_Capability;
export const Capability = P_Capability;

export type Model = AIModel & { capabilities?: AIModelCapability[] };

// manageable: the signed-in user can change it (their own).
export type Provider = AIProvider & { models?: Model[]; manageable?: boolean };
