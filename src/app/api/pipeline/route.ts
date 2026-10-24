import { NextResponse } from "next/server";

import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { apiUser } from "@/lib/session";

export async function GET() {
  const { error: authError } = await apiUser({ admin: true });
  if (authError) return authError;

  await pipelineRuntime.initialize();
  return NextResponse.json(await pipelineRuntime.getConfig());
}

export async function PUT(request: Request) {
  const { error: authError } = await apiUser({ admin: true });
  if (authError) return authError;

  try {
    await pipelineRuntime.updateParameters(await request.json());
    return NextResponse.json(await pipelineRuntime.getConfig());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'enregistrer les paramètres du pipeline." },
      { status: 400 },
    );
  }
}