import { getProjectConversations } from "@/lib/queries/conversation";

type ProjectConversationPageProps = {
  params: Promise<{ projectId: string, conversationId: string }>;
};

export default async function ProjectConversations({ params }: ProjectConversationPageProps) {
    const { projectId, conversationId } = await params;

    const conversations = await getProjectConversations(projectId);

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-10">
            <h1 className="text-2xl font-bold">Conversations</h1>

            {conversations.map((conversation) => (
                <div key={conversation.id}>
                    <h2>{conversation.title}</h2>
                </div>
            ))}
        </div>
    )
}