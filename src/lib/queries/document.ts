import { prisma } from "@/lib/prisma";
import { JobStatus, type Prisma } from "@prisma/client";

// The latest indexing job of each document, to tell its error and whether it is running.
const latestJob = {
  indexingJobs: {
    select: { id: true, status: true, errorMessage: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.DocumentInclude;

type WithLatestJob = { indexingJobs: { id: string; status: JobStatus; errorMessage: string | null }[] };

function withIndexingState<T extends WithLatestJob>({ indexingJobs: [job], ...document }: T) {
  return {
    ...document,
    indexingError: job?.errorMessage ?? null,
    activeJobId: job && (job.status === JobStatus.QUEUED || job.status === JobStatus.RUNNING) ? job.id : null,
  };
}

/**
 * Documents with the error message of their latest indexing job (null when it did not fail)
 * and its id while it is queued or running, for the page to follow it.
 */
export async function getAllDocuments() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { ...latestJob, ownerProject: { select: { id: true, name: true } } },
  });

  return documents.map(withIndexingState);
}

/**
 * The documents of a project: imported for it, selected in the library, and the library documents it can still
 * select.
 */
export async function getProjectDocuments(projectId: string) {
  const [owned, selected, library] = await Promise.all([
    prisma.document.findMany({ where: { ownerProjectId: projectId }, orderBy: { createdAt: "desc" }, include: latestJob }),
    prisma.document.findMany({
      // Not "NOT owner = project": in SQL that is null, not true, for the library documents (no owner).
      where: { projects: { some: { projectId } }, OR: [{ ownerProjectId: null }, { ownerProjectId: { not: projectId } }] },
      orderBy: { displayName: "asc" },
      include: latestJob,
    }),
    prisma.document.findMany({
      where: { ownerProjectId: null, projects: { none: { projectId } } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, format: true, indexingStatus: true },
    }),
  ]);

  return { owned: owned.map(withIndexingState), selected: selected.map(withIndexingState), library };
}

export type ProjectDocuments = Awaited<ReturnType<typeof getProjectDocuments>>;

export function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}
