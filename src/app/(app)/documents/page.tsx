import { DocumentsDisplay } from "@/components/documents/DocumentDisplay";
import { getAllDocuments } from "@/lib/queries/document";


export default async function DocumentPage() {
  const documents = await getAllDocuments();

  return (
    <DocumentsDisplay initialDocuments={documents} />
  );
}