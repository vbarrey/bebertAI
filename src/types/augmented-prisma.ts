import { AIModel, AIProvider, Capability as P_Capability } from "@prisma/client";

export type Capability = P_Capability;
export const Capability = P_Capability;

export type Model = AIModel & { capabilities?: Capability[] };

export type Provider = AIProvider & { models?: Model[] };