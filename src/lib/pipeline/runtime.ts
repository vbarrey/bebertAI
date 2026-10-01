import { PipelineConfig } from "./config";
import { defaultPipelineParameters } from "./default";
import { pipelineCapabilities } from "./capabilities";
import { PipelineParametersSchema, PipelineParameters } from "./parameters";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

class PipelineRuntime {
  private config: PipelineConfig | null = null;

  async initialize() {
    if(this.config) return;

    const storedParameters = await prisma.pipelineParameters.findUnique({
      where: { id: 1 },
    });

    let pipelineParameters: PipelineParameters;

    if (!storedParameters) {
      console.log("No parameters stored in database - using default parameters");

      pipelineParameters = this.parseParameters(defaultPipelineParameters);

      await prisma.pipelineParameters.create({
        data: {
          id: 1,
          parameters: JSON.stringify(pipelineParameters),
        },
      });
    } else {
      pipelineParameters = this.parseParameters(storedParameters.parameters);
    }

    this.config = {
      parameters: pipelineParameters,
      capabilities: pipelineCapabilities,
    };
  }

  async getConfig(): Promise<PipelineConfig> {
    if (!this.config){
      await this.initialize();
    }
      
    return this.config!;
  }

  async updateParameters(parameters: unknown) {
    if(!this.config) await this.initialize();

    const validatedParameters = this.parseParameters(parameters);

    await prisma.pipelineParameters.update({
      where: { id: 1 },
      data: {
        parameters: JSON.stringify(validatedParameters),
      },
    });

    this.config = {
      ...(await this.getConfig()),
      parameters: validatedParameters,
    };
  }

  private parseParameters(parameters: unknown): PipelineParameters {
    try {
      const rawParameters =
        typeof parameters === "string" ? JSON.parse(parameters) : parameters;

      return PipelineParametersSchema.parse(rawParameters);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Unable to parse pipeline parameters JSON.", {
          cause: error,
        });
      }

      if (error instanceof z.ZodError) {
        throw new Error("Unable to validate pipeline parameters.", {
          cause: error,
        });
      }

      throw new Error("Unexpected error while parsing pipeline parameters.", {
        cause: error,
      });
    }
  }
}

const globalForPipeline = globalThis as unknown as {
    pipelineRuntime: PipelineRuntime | undefined;
};

export const pipelineRuntime =
    globalForPipeline.pipelineRuntime ??
    new PipelineRuntime();

if (process.env.NODE_ENV !== "production") {
    globalForPipeline.pipelineRuntime = pipelineRuntime;
}