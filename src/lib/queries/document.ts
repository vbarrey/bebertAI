import { prisma } from "@/lib/prisma";
import { JobStatus, Prisma, type IndexingStatus } from "@prisma/client";
import type { DocumentListQuery, DocumentPageQuery, DocumentSortColumn } from "@/lib/documents/list-query";

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

// The sort of each column. Case-insensitive for the text: SQLite compares bytes otherwise, "Zèbre" before "abeille".
const sortExpressions: Record<DocumentSortColumn, Prisma.Sql> = {
  displayName: Prisma.sql`"displayName" COLLATE NOCASE`,
  // The name of the project it was imported for: null for a library document, last.
  project: Prisma.sql`(SELECT "name" FROM "Project" WHERE "Project"."id" = "Document"."ownerProjectId") COLLATE NOCASE`,
  format: Prisma.sql`"format" COLLATE NOCASE`,
  fileSize: Prisma.sql`"fileSize"`,
  language: Prisma.sql`"language"`,
  indexedAt: Prisma.sql`"indexedAt"`,
  updatedAt: Prisma.sql`"updatedAt"`,
  createdAt: Prisma.sql`"createdAt"`,
};

// The % and _ of a search are letters of the name, not wildcards.
function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function documentListWhere(userId: string, { search, status, location }: DocumentListQuery) {
  const conditions = [Prisma.sql`"userId" = ${userId}`];

  if (search) conditions.push(Prisma.sql`"displayName" LIKE ${`%${escapeLike(search)}%`} ESCAPE '\\'`);
  if (status !== "ALL") conditions.push(Prisma.sql`"indexingStatus" = ${status}`);
  if (location === "LIBRARY") conditions.push(Prisma.sql`"ownerProjectId" IS NULL`);
  else if (location !== "ALL") conditions.push(Prisma.sql`"ownerProjectId" = ${location}`);

  return Prisma.join(conditions, " AND ");
}

/**
 * A slice of the documents page: the documents matching its filters, in its sort, with the error message of their
 * latest indexing job (null when it did not fail) and its id while it is queued or running, for the page to follow
 * it. With how many match in all, to tell whether more remain.
 *
 * In SQL for the ids: Prisma cannot sort case-insensitively. The empty values last whatever the order, the id breaking
 * the ties so that the slices follow one another without overlapping.
 */
export async function getDocumentsPage(userId: string, query: DocumentPageQuery) {
  const where = documentListWhere(userId, query);
  const direction = Prisma.raw(query.order === "asc" ? "ASC" : "DESC");

  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Document" WHERE ${where}
      ORDER BY ${sortExpressions[query.sort]} ${direction} NULLS LAST, "id" ${direction}
      LIMIT ${query.limit} OFFSET ${query.offset}`,
    prisma.$queryRaw<{ total: number | bigint }[]>`SELECT COUNT(*) AS "total" FROM "Document" WHERE ${where}`,
  ]);

  const ids = rows.map(({ id }) => id);
  const documents = await prisma.document.findMany({
    where: { userId, id: { in: ids } },
    include: { ...latestJob, ownerProject: { select: { id: true, name: true } } },
  });
  const byId = new Map(documents.map((document) => [document.id, withIndexingState(document)]));

  return {
    // Deleted between the two queries: left out.
    documents: ids.flatMap((id) => byId.get(id) ?? []),
    total: Number(total),
  };
}

export type DocumentsPage = Awaited<ReturnType<typeof getDocumentsPage>>;
export type DocumentRow = DocumentsPage["documents"][number];

/** For the cards and filters of the documents page: counted over all the user's documents, whatever the filters. */
export async function getDocumentStats(userId: string) {
  const [byStatus, ownerProjects] = await Promise.all([
    prisma.document.groupBy({ by: ["indexingStatus"], where: { userId }, _count: { _all: true } }),
    // The projects that have their own documents, for the location filter.
    prisma.project.findMany({
      where: { userId, ownedDocuments: { some: {} } },
      select: { id: true, name: true },
    }),
  ]);

  const counts: Partial<Record<IndexingStatus, number>> = Object.fromEntries(
    byStatus.map((group) => [group.indexingStatus, group._count._all]),
  );

  return {
    counts,
    total: byStatus.reduce((sum, group) => sum + group._count._all, 0),
    // In the alphabetical order of the project column, whatever the case (SQLite compares bytes).
    ownerProjects: ownerProjects.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" })),
  };
}

export type DocumentStats = Awaited<ReturnType<typeof getDocumentStats>>;

/**
 * The documents of a project: imported for it, selected in the library, and the library documents it can still
 * select.
 */
export async function getProjectDocuments(projectId: string, userId: string) {
  const [owned, selected, library] = await Promise.all([
    prisma.document.findMany({ where: { userId, ownerProjectId: projectId }, orderBy: { createdAt: "desc" }, include: latestJob }),
    prisma.document.findMany({
      // Not "NOT owner = project": in SQL that is null, not true, for the library documents (no owner).
      where: { userId, projects: { some: { projectId } }, OR: [{ ownerProjectId: null }, { ownerProjectId: { not: projectId } }] },
      orderBy: { displayName: "asc" },
      include: latestJob,
    }),
    prisma.document.findMany({
      where: { userId, ownerProjectId: null, projects: { none: { projectId } } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, format: true, indexingStatus: true },
    }),
  ]);

  return { owned: owned.map(withIndexingState), selected: selected.map(withIndexingState), library };
}

export type ProjectDocuments = Awaited<ReturnType<typeof getProjectDocuments>>;

// For the indexing worker: the job already names its document.
export function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}
