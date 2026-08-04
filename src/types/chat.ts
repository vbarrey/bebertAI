import { MessageRole, MessageStatus } from "@prisma/client";

export type ChatMessage = {
    id: string;
    role: MessageRole;
    status: MessageStatus;
    content: string;
    createdAt: Date;
};