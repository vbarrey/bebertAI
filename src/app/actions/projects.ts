"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { projectService } from "@/modules/projects/project.service";

export async function createProjectAction(formData: FormData) {
  const project = await projectService.create(formData.get("name")?.toString());
  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function renameProjectAction(formData: FormData) {
  const projectId = formData.get("projectId")?.toString();

  if (!projectId) return;

  await projectService.rename(projectId, formData.get("name")?.toString() ?? null);
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}
