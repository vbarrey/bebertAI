import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getConversationWithMessages } from "@/lib/queries/conversation";
import { requireUser } from "@/lib/session";
import { ChatPanel } from "@/components/conversations/chat/ChatPanel";
import { TruncatedText } from "@/components/ui/truncated-text";

type ConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

// The conversation read once for the title and the page: getConversationWithMessages is cached per request.
// Its generated title shows once the first answer refreshes the page.
export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  const { conversationId } = await params;
  const conversation = await getConversationWithMessages(conversationId, (await requireUser()).id);

  // Missing: the page shows the not found page. Without a title yet: like its heading.
  return { title: !conversation ? "Page introuvable" : conversation.title ?? "Nouvelle conversation" };
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  const user = await requireUser();
  const conversation = await getConversationWithMessages(conversationId, user.id);

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
        userId={user.id}
        conversationId={conversation.id}
        title={conversation.title}
        messages={conversation.messages}
        model={conversation.model}
      />
    </div>
  );
}
