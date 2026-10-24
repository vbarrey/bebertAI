"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { DocumentScope } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addToProjectSelection } from "@/lib/mutations/document";
import { requireUser } from "@/lib/session";

const NEW_PROJECT_NAME = "Nouveau projet";

/** "Nouveau projet", else "Nouveau projet 2", 3…: project names are unique for their owner. */
async function newProjectName(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId, name: { startsWith: NEW_PROJECT_NAME } },
    select: { name: true },
  });
  const taken = new Set(projects.map((project) => project.name));

  let name = NEW_PROJECT_NAME;
  for (let n = 2; taken.has(name); n++) name = `${NEW_PROJECT_NAME} ${n}`;
  return name;
}

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const projectName = formData.get("projectName")?.toString().trim() || await newProjectName(user.id);

  const res = await prisma.project.create({data: {
    userId: user.id,
    name: projectName
  }});

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${res.id}`);
}

export async function updateProject(formData: FormData) {
  const user = await requireUser();
  const projectId = formData.get("projectId")?.toString();
  const projectName = formData.get("name")?.toString();
  const projectDescription = formData.get("description")?.toString();

  if (!projectId || !projectName) return; // TODO : Handle validation error

  await prisma.project.updateMany({
    where: {
      id: projectId,
      userId: user.id,
    },
    data: {
      name: projectName,
      description: projectDescription
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}

/** Where the conversations of the project search: the whole library, or the documents selected in it. */
export async function setProjectDocumentScope(projectId: string, documentScope: DocumentScope) {
  const user = await requireUser();
  await prisma.project.updateMany({ where: { id: projectId, userId: user.id }, data: { documentScope } });
  revalidatePath(`/projects/${projectId}`);
}

export async function selectProjectDocuments(projectId: string, documentIds: string[]) {
  const user = await requireUser();
  await addToProjectSelection(user.id, projectId, documentIds);
  revalidatePath(`/projects/${projectId}`);
}

export async function unselectProjectDocument(projectId: string, documentId: string) {
  const user = await requireUser();
  await prisma.projectDocument.deleteMany({ where: { projectId, documentId, project: { userId: user.id } } });
  revalidatePath(`/projects/${projectId}`);
}
