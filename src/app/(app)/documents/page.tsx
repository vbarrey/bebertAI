import { DocumentsDisplay } from "@/components/documents/DocumentDisplay";
import { getAllDocuments } from "@/lib/queries/document";
import { requireUser } from "@/lib/session";


type Props = {
  // Set by the Google Drive OAuth callback: connected or error.
  searchParams: Promise<{ googleDrive?: string }>;
};

export default async function DocumentPage({ searchParams }: Props) {
  const user = await requireUser();
  const documents = await getAllDocuments(user.id);
  const { googleDrive } = await searchParams;

  return (
    <DocumentsDisplay initialDocuments={documents} googleDriveResult={googleDrive} />
  );
}