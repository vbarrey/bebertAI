import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getConversationWithMessages } from "@/lib/queries/conversation";
import { ChatPanel } from "@/components/conversations/chat/ChatPanel";
import { TruncatedText } from "@/components/ui/truncated-text";

type ConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  const conversation = await getConversationWithMessages(conversationId);

  if (!conversation) notFound();

  return (
    <div className="mx-auto flex h-full w-full container flex-col p-6 lg:p-10">
      {conversation.project && (
        <Link
          href={`/projects/${conversation.project.id}`}
          className="mb-1 flex w-fit max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4 shrink-0" />
          <TruncatedText>{conversation.project.name}</TruncatedText>
        </Link>
      )}

      <ChatPanel
        conversationId={conversation.id}
        title={conversation.title}
        messages={conversation.messages}
        model={conversation.model}
      />
    </div>
  );
}
