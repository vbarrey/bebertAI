import { prisma } from "@/lib/prisma";
import { cache } from "react";

export const getConversationMessages = cache((conversationId: string) =>
  prisma.message.findMany({ where: { conversationId } })
);
