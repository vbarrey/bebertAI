import type { Metadata } from "next";
import { DocumentsDisplay } from "@/components/documents/DocumentDisplay";
import { getAllDocuments } from "@/lib/queries/document";
import { getProjects } from "@/lib/queries/project";
import { requireUser } from "@/lib/session";


type Props = {
  // Set by the Google Drive OAuth callback: connected or error.
  searchParams: Promise<{ googleDrive?: string }>;
};

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentPage({ searchParams }: Props) {
  const user = await requireUser();
  const [documents, projects] = await Promise.all([getAllDocuments(user.id), getProjects(user.id)]);
  const { googleDrive } = await searchParams;

  return (
    <DocumentsDisplay
      documents={documents}
      projects={projects.map(({ id, name }) => ({ id, name }))}
      googleDriveResult={googleDrive}
    />
  );
}