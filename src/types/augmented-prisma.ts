import { AIModel, AIModelCapability, AIProvider, Capability as P_Capability } from "@prisma/client";

export type Capability = P_Capability;
export const Capability = P_Capability;

export type Model = AIModel & { capabilities?: AIModelCapability[] };

export type Provider = AIProvider & { models?: Model[] };
