import { MessageRole, MessageStatus } from "@prisma/client";
import type { ChatStep } from "@/lib/ai/chat/steps";
import type { ChatSource } from "@/lib/ai/types";

export type ChatMessage = {
    id: string;
    role: MessageRole;
    status: MessageStatus;
    content: string;
    createdAt: Date;
    // Progress of an answer being generated, never saved.
    step?: ChatStep;
    // Documents the answer was generated from.
    sources?: ChatSource[];
};