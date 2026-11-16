import type { Metadata } from "next";
import { DocumentsDisplay } from "@/components/documents/DocumentDisplay";
import { DOCUMENTS_PAGE_SIZE, defaultDocumentListQuery } from "@/lib/documents/list-query";
import { getDocumentStats, getDocumentsPage } from "@/lib/queries/document";
import { getProjects } from "@/lib/queries/project";
import { requireUser } from "@/lib/session";


type Props = {
  // Set by the Google Drive OAuth callback: connected or error.
  searchParams: Promise<{ googleDrive?: string }>;
};

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentPage({ searchParams }: Props) {
  const user = await requireUser();
  const [initialPage, stats, projects] = await Promise.all([
    getDocumentsPage(user.id, { ...defaultDocumentListQuery, offset: 0, limit: DOCUMENTS_PAGE_SIZE }),
    getDocumentStats(user.id),
    getProjects(user.id),
  ]);
  const { googleDrive } = await searchParams;

  return (
    <DocumentsDisplay
      initialPage={initialPage}
      stats={stats}
      projects={projects.map(({ id, name }) => ({ id, name }))}
      googleDriveResult={googleDrive}
    />
  );
}
