"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const NEW_PROJECT_NAME = "Nouveau projet";

/** "Nouveau projet", else "Nouveau projet 2", 3…: project names are unique. */
async function newProjectName() {
  const projects = await prisma.project.findMany({
    where: { name: { startsWith: NEW_PROJECT_NAME } },
    select: { name: true },
  });
  const taken = new Set(projects.map((project) => project.name));

  let name = NEW_PROJECT_NAME;
  for (let n = 2; taken.has(name); n++) name = `${NEW_PROJECT_NAME} ${n}`;
  return name;
}

export async function createProject(formData: FormData) {
  const projectName = formData.get("projectName")?.toString().trim() || await newProjectName();

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
