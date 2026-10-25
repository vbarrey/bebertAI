import { NextResponse } from "next/server";

import { updatePipelineParameters } from "@/lib/pipeline/runtime";
import { apiUser } from "@/lib/session";

export async function PUT(request: Request) {
  const { user, error: authError } = await apiUser();
  if (authError) return authError;

  try {
    return NextResponse.json(await updatePipelineParameters(user.id, await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'enregistrer les paramètres du pipeline." },
      { status: 400 },
    );
  }
}
