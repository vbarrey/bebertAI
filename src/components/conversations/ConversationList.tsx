import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MessagesSquare } from "lucide-react";

import { provisionalTitle } from "@/lib/ai/chat/title";
import { groupByDate } from "@/lib/date-groups";
import { cn } from "@/lib/utils";

import { TruncatedText } from "@/components/ui/truncated-text";

import { ConversationMenu } from "./ConversationMenu";

export type ConversationListItem = {
  id: string;
  title: string | null;
  lastMessageAt: Date;
  _count: { messages: number };
  messages: { content: string }[];
};

type Projects = { id: string; name: string }[];

type ConversationListProps = {
  projectId: string;
  conversations: ConversationListItem[];
  // Where a conversation can be moved.
  projects: Projects;
};

/** The conversations of a project, most recent first, grouped by the day of their last message. */
export function ConversationList({ projectId, conversations, projects }: ConversationListProps) {
  const groups = groupByDate(conversations, (conversation) => conversation.lastMessageAt);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h3>

          <ul className="divide-y overflow-hidden rounded-xl border">
            {group.items.map((conversation) => (
              <ConversationRow key={conversation.id} projectId={projectId} projects={projects} conversation={conversation} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ConversationRow({ projectId, projects, conversation }: { projectId: string; projects: Projects; conversation: ConversationListItem }) {
  const firstQuestion = conversation.messages[0]?.content;
  const title = conversation.title ?? (firstQuestion ? provisionalTitle(firstQuestion) : null);
  const messageCount = conversation._count.messages;

  return (
    <li className="group relative transition-colors hover:bg-accent/50">
      <Link
        href={`/conversations/${conversation.id}`}
        className="flex items-center gap-3 px-4 py-3 pr-14 outline-none focus-visible:bg-accent/50"
      >
        <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <TruncatedText className={cn("font-medium", !title && "italic text-muted-foreground")}>
            {title ?? "Conversation vide"}
          </TruncatedText>

          {conversation.title && firstQuestion && (
            <TruncatedText className="text-sm text-muted-foreground">{firstQuestion}</TruncatedText>
          )}
        </div>

        <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
          <p>{formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true, locale: fr })}</p>
          <p>{messageCount} message{messageCount !== 1 && "s"}</p>
        </div>
      </Link>

      <div className="absolute top-1/2 right-3 -translate-y-1/2">
        <ConversationMenu
          conversation={{ id: conversation.id, title }}
          projectId={projectId}
          projects={projects}
          className="size-8 opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
        />
      </div>
    </li>
  );
}
