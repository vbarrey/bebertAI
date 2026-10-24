import { NextResponse } from "next/server";

import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { apiUser } from "@/lib/session";

export async function GET() {
  const { user, error: authError } = await apiUser();
  if (authError) return authError;

  return NextResponse.json(await pipelineRuntime.getConfig(user.id));
}

export async function PUT(request: Request) {
  const { user, error: authError } = await apiUser();
  if (authError) return authError;

  try {
    await pipelineRuntime.updateParameters(user.id, await request.json());
    return NextResponse.json(await pipelineRuntime.getConfig(user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'enregistrer les paramètres du pipeline." },
      { status: 400 },
    );
  }
}