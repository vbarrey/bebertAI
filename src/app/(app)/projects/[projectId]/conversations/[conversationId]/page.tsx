import { getConversationWithMessages } from "@/lib/queries/conversation";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/conversations/chat/ChatPanel";

type ConversationPageProps = {
  params: Promise<{ projectId: string; conversationId: string }>;
};

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { projectId, conversationId } = await params;

  const conversation = await getConversationWithMessages(conversationId, projectId);

  if (!conversation) notFound();

  return (
    <div className="mx-auto flex h-full w-full container flex-col p-6 lg:p-10">
      <h1 className="mb-5 truncate text-2xl font-bold">
        {conversation.title ?? "Nouvelle conversation"}
      </h1>

      <ChatPanel 
        conversationId={conversation.id}
        messages={conversation.messages}
        model={conversation.model}
        projectId={projectId}/>
    </div>
  );
}
