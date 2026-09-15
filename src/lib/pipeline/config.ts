import { PipelineCapabilities } from "./capabilities";
import { PipelineParameters } from "./parameters"

export type PipelineConfig = {
    parameters: PipelineParameters; // Stored in Prisma database - Contains parameters that can be tunes for each steps of the pipeline (size of chunks, models for embedding or generating etc...)
    capabilities: PipelineCapabilities; // Derived from app itself - Contains all that the app capabilities, the things it could do for each step (supported document types, chunking strategy etc...)
}