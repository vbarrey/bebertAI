
import { getConversationWithMessages } from "@/lib/queries/conversation"
import { notFound } from "next/navigation";

type ConversationPageProps = {
  params: Promise<{ projectId: string, conversationId: string }>;
};

export default async function ConversationPage({ params }: ConversationPageProps) {
    const { projectId, conversationId } = await params;

    const conversation = await getConversationWithMessages(conversationId);

    if (!conversation) notFound();

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-10">
            <h1 className="text-2xl font-bold">Conversations {conversation.title}</h1>
            {conversation.messages.map((message) => (
                <div key={message.id} className="my-4">
                    <p>{message.content}</p>
                </div>
            ))}
        </div>
    )
}