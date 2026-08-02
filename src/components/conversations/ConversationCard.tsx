"use client";

import Link from "next/link";
import type { Conversation } from "@prisma/client";
import { usePathname } from "next/navigation";

import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MessagesSquare, Clock3 } from "lucide-react";

type ConversationCardProps = {
  conversation: Conversation;
};

export function ConversationCard({ conversation }: ConversationCardProps) {

  const pathname = usePathname();

  const projectId = pathname.split("/")[2];

  return (
    <Link href={`${projectId}/conversations/${conversation.id}`} className="group block w-full">
      <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <MessagesSquare className="h-5 w-5 text-primary" />

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {conversation.lastMessageAt.toLocaleDateString("fr-FR")}
            </div>
          </div>

          <div>
            <CardTitle className="truncate">
              {conversation.title}
            </CardTitle>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}