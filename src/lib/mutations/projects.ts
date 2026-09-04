"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export async function createProject(formData: FormData) {
  const projectName = formData.get("projectName")?.toString();

  if (!projectName) return; // TODO : Handle validation error

  const res = await prisma.project.create({data: {
    name: projectName
  }});

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${res.id}`);
}

export async function updateProject(formData: FormData) {
  const projectId = formData.get("projectId")?.toString();
  const projectName = formData.get("name")?.toString();
  const projectDescription = formData.get("description")?.toString();

  if (!projectId || !projectName) return; // TODO : Handle validation error

  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name: projectName,
      description: projectDescription
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}
