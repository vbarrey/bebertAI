import Link from "next/link";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MessagesSquare } from "lucide-react";

import { provisionalTitle } from "@/lib/ai/chat/title";
import { cn } from "@/lib/utils";

import { DeleteConversationButton } from "./DeleteConversationButton";

export type ConversationListItem = {
  id: string;
  title: string | null;
  lastMessageAt: Date;
  _count: { messages: number };
  messages: { content: string }[];
};

type ConversationListProps = {
  projectId: string;
  conversations: ConversationListItem[];
};

const GROUPS = [
  { label: "Aujourd'hui", maxDays: 0 },
  { label: "Hier", maxDays: 1 },
  { label: "7 derniers jours", maxDays: 6 },
  { label: "30 derniers jours", maxDays: 29 },
  { label: "Plus ancien", maxDays: Infinity },
];

/** The conversations of a project, most recent first, grouped by the day of their last message. */
export function ConversationList({ projectId, conversations }: ConversationListProps) {
  const now = new Date();
  const groups = GROUPS.map((group) => ({ ...group, conversations: [] as ConversationListItem[] }));

  for (const conversation of conversations) {
    const days = differenceInCalendarDays(now, conversation.lastMessageAt);
    groups.find((group) => days <= group.maxDays)?.conversations.push(conversation);
  }

  return (
    <div className="space-y-8">
      {groups.filter((group) => group.conversations.length > 0).map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h3>

          <ul className="divide-y overflow-hidden rounded-xl border">
            {group.conversations.map((conversation) => (
              <ConversationRow key={conversation.id} projectId={projectId} conversation={conversation} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ConversationRow({ projectId, conversation }: { projectId: string; conversation: ConversationListItem }) {
  const firstQuestion = conversation.messages[0]?.content;
  const title = conversation.title ?? (firstQuestion ? provisionalTitle(firstQuestion) : null);
  const messageCount = conversation._count.messages;

  return (
    <li className="group relative transition-colors hover:bg-accent/50">
      <Link
        href={`/projects/${projectId}/conversations/${conversation.id}`}
        className="flex items-center gap-3 px-4 py-3 pr-14 outline-none focus-visible:bg-accent/50"
      >
        <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", !title && "italic text-muted-foreground")}>
            {title ?? "Conversation vide"}
          </p>

          {conversation.title && firstQuestion && (
            <p className="truncate text-sm text-muted-foreground">{firstQuestion}</p>
          )}
        </div>

        <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
          <p>{formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true, locale: fr })}</p>
          <p>{messageCount} message{messageCount !== 1 && "s"}</p>
        </div>
      </Link>

      <div className="absolute top-1/2 right-3 -translate-y-1/2">
        <DeleteConversationButton
          projectId={projectId}
          conversationId={conversation.id}
          title={title ?? "Conversation vide"}
        />
      </div>
    </li>
  );
}
