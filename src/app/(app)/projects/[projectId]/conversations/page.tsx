import { redirect } from "next/navigation";

type ProjectConversationsPageProps = {
  params: Promise<{ projectId: string }>;
};

// The conversations of a project are listed on its page.
export default async function ProjectConversationsPage({ params }: ProjectConversationsPageProps) {
    const { projectId } = await params;
    redirect(`/projects/${projectId}`);
}
